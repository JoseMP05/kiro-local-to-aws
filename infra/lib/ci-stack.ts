// Identidad de GitHub Actions en AWS, sin claves guardadas en GitHub (OIDC).
//
// Dos roles con permisos mínimos y separados:
// - tank-game-gh-deploy: solo lo asume un workflow que corre en la rama main
//   (push o ejecución manual). Puede asumir los roles de bootstrap de CDK y
//   nada más; CloudFormation hace el resto con su propio rol.
// - tank-game-gh-pr-review: lo asume el workflow de revisión de PRs (que
//   también corre para PRs de forks). Solo puede invocar modelos Claude Haiku
//   en Amazon Bedrock. Si alguien lograra abusar de él, lo único que obtiene
//   es una llamada a Haiku.

import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

export interface CiStackProps extends StackProps {
  /** Repositorio de GitHub, "propietario/nombre". */
  githubRepo: string;
}

export class CiStack extends Stack {
  constructor(scope: Construct, id: string, props: CiStackProps) {
    super(scope, id, props);
    const repo = props.githubRepo;

    const provider = new iam.OidcProviderNative(this, "GitHubOidc", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
    });

    const principal = (subject: string, operator: "StringEquals" | "StringLike") =>
      new iam.WebIdentityPrincipal(provider.oidcProviderArn, {
        StringEquals: { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
        [operator]: { "token.actions.githubusercontent.com:sub": subject },
      });

    // ── Despliegue: solo desde main ──
    const deployRole = new iam.Role(this, "DeployRole", {
      roleName: "tank-game-gh-deploy",
      description: `GitHub Actions (${repo}, rama main) despliega con CDK`,
      assumedBy: principal(`repo:${repo}:ref:refs/heads/main`, "StringEquals"),
    });
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AsumirRolesDeBootstrapDeCdk",
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*-${this.account}-${this.region}`],
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "LeerSalidasDelStack",
        actions: ["cloudformation:DescribeStacks"],
        resources: [`arn:aws:cloudformation:${this.region}:${this.account}:stack/TankGame*/*`],
      }),
    );

    // ── Revisión de PRs: cualquier workflow del repo, solo Bedrock Haiku ──
    const reviewRole = new iam.Role(this, "PrReviewRole", {
      roleName: "tank-game-gh-pr-review",
      description: `GitHub Actions (${repo}) revisa PRs con Claude Haiku en Bedrock`,
      assumedBy: principal(`repo:${repo}:*`, "StringLike"),
    });
    reviewRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "InvocarClaudeHaiku",
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: [
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*anthropic.claude-haiku-*`,
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-*",
        ],
      }),
    );

    new CfnOutput(this, "DeployRoleArn", { value: deployRole.roleArn });
    new CfnOutput(this, "PrReviewRoleArn", { value: reviewRole.roleArn });
  }
}
