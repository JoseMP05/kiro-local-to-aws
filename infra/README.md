# Infraestructura de referencia (AWS CDK)

Solución de referencia para la charla. Vive en la rama `referencia-aws` para que Kiro no la vea en `main` durante la demo en vivo.

```
Navegador ──HTTPS/WSS──▶ CloudFront ──HTTP/WS──▶ ALB ──▶ ECS Fargate (1 tarea, :3000)
                                                 ▲              │
                                       SG: solo CloudFront    ECR + CloudWatch Logs
```

## Comandos

```bash
npm install
npx cdk synth --strict
npx cdk deploy TankGameRef --require-approval never --outputs-file cdk-outputs.json
npx cdk destroy TankGameRef --force
```

- Cuenta Charla-Kiro (661443221249), región `us-east-1`, ya inicializada con `cdk bootstrap`.
- Otro nombre de stack: `npx cdk deploy -c stackName=Otro Otro`.
- La prefix list de CloudFront (`pl-3b927c52`) es la de `us-east-1`; en otra región cámbiala con `-c cloudFrontPrefixListId=...`.

## Decisiones

| Decisión | Motivo |
| --- | --- |
| `desiredCount 1`, `minHealthyPercent 0`, `maxHealthyPercent 100` | El estado vive en memoria: nunca dos partidas, ni durante un despliegue |
| CloudFront con `CachingDisabled` + `AllViewer` | HTTPS sin dominio propio y cabeceras de WebSocket hasta el origen |
| SG del ALB con la prefix list de CloudFront | Nadie entra por HTTP saltándose la CDN |
| Deregistration delay 5 s, health check `/health` cada 10 s | El servidor se apaga en menos de 3 s |
| Subredes públicas sin NAT | Ahorra ~32 USD/mes |
| x86_64 | La imagen se construye en un portátil x86 |

La guía completa de la charla está en [`docs/charla.html`](../docs/charla.html).
