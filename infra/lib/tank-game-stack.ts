// Arquitectura de referencia del juego de tanques en AWS.
//
//   Navegador ──HTTPS/WSS──▶ CloudFront ──HTTP/WS──▶ ALB ──▶ ECS Fargate (1 tarea)
//
// Decisiones que salen del "Contrato de despliegue" del README:
// - Una sola réplica: el estado de la partida vive en memoria. Por eso
//   desiredCount = 1 y, durante los despliegues, nunca hay dos tareas a la vez.
// - HTTP y WebSocket en el mismo puerto (3000): un único target group.
// - /health para el health check del balanceador.
// - Apagado ordenado en < 3 s: el deregistration delay puede ser corto.
// - CloudFront da HTTPS gratis con *.cloudfront.net y el cliente pasa a wss://
//   automáticamente.

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const GAME_PORT = 3000;

export interface TankGameStackProps extends StackProps {
  /** Prefix list administrada "com.amazonaws.global.cloudfront.origin-facing" de la región. */
  cloudFrontPrefixListId: string;
}

export class TankGameStack extends Stack {
  constructor(scope: Construct, id: string, props: TankGameStackProps) {
    super(scope, id, props);

    // ── Red: 2 zonas, solo subredes públicas, sin NAT (ahorra ~32 USD/mes) ──
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: "publica", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 }],
    });

    // ── Balanceador: solo acepta tráfico que viene de CloudFront ──
    const albSg = new ec2.SecurityGroup(this, "AlbSg", {
      vpc,
      description: "ALB: solo trafico desde CloudFront",
      allowAllOutbound: false,
    });
    albSg.addIngressRule(
      ec2.Peer.prefixList(props.cloudFrontPrefixListId),
      ec2.Port.tcp(80),
      "HTTP desde los servidores de origen de CloudFront",
    );

    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
      idleTimeout: Duration.seconds(120), // el servidor manda ping cada 10 s
    });

    // ── Contenedor: la imagen se construye desde el Dockerfile del repo y CDK la sube a ECR ──
    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    const logGroup = new logs.LogGroup(this, "Logs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: 1024, // 1 vCPU: el bucle de ticks es de un solo hilo
      memoryLimitMiB: 2048,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    taskDef.addContainer("game", {
      image: ecs.ContainerImage.fromAsset(REPO_ROOT, {
        platform: ecrAssets.Platform.LINUX_AMD64,
      }),
      portMappings: [{ containerPort: GAME_PORT }],
      environment: { PORT: String(GAME_PORT), NODE_ENV: "production" },
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: "game" }),
      stopTimeout: Duration.seconds(10),
    });

    const serviceSg = new ec2.SecurityGroup(this, "ServiceSg", {
      vpc,
      description: "Tarea del juego: solo trafico desde el ALB",
    });
    serviceSg.addIngressRule(albSg, ec2.Port.tcp(GAME_PORT), "Juego desde el ALB");
    albSg.addEgressRule(serviceSg, ec2.Port.tcp(GAME_PORT), "ALB hacia la tarea");

    const service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      // Una sola partida: primero se para la tarea vieja y luego arranca la nueva.
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      circuitBreaker: { rollback: true },
      assignPublicIp: true, // sin NAT, necesita IP pública para descargar de ECR
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [serviceSg],
      healthCheckGracePeriod: Duration.seconds(30),
      enableExecuteCommand: true,
    });

    const listener = alb.addListener("Http", {
      port: 80,
      open: false, // el SG ya limita a CloudFront
    });
    listener.addTargets("Game", {
      port: GAME_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      deregistrationDelay: Duration.seconds(5),
      healthCheck: {
        path: "/health",
        interval: Duration.seconds(10),
        timeout: Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // ── CloudFront: HTTPS con certificado gratuito y soporte de WebSocket ──
    const distribution = new cloudfront.Distribution(this, "Cdn", {
      comment: `${id}: juego de tanques`,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          readTimeout: Duration.seconds(60),
          keepaliveTimeout: Duration.seconds(60),
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        // Nada se cachea: es un juego en tiempo real y el WebSocket necesita
        // que lleguen al origen las cabeceras Upgrade y Sec-WebSocket-*.
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
    });

    // ── Salidas ──
    const url = `https://${distribution.distributionDomainName}`;
    new CfnOutput(this, "GameUrl", { value: `${url}/`, description: "Juego" });
    new CfnOutput(this, "SpectatorUrl", { value: `${url}/espectador`, description: "Vista de espectador" });
    new CfnOutput(this, "HealthUrl", { value: `${url}/health`, description: "Estado del servidor" });
    new CfnOutput(this, "ClusterName", { value: cluster.clusterName });
    new CfnOutput(this, "ServiceName", { value: service.serviceName });
    new CfnOutput(this, "LogGroupName", { value: logGroup.logGroupName });
  }
}
