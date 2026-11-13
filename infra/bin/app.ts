#!/usr/bin/env node
// Punto de entrada de CDK. El nombre del stack se puede cambiar con
// `-c stackName=Otro` para no chocar con el que se cree en vivo con Kiro.
import { App, Tags } from "aws-cdk-lib";
import { TankGameStack } from "../lib/tank-game-stack.ts";
import { CiStack } from "../lib/ci-stack.ts";

const app = new App();
const stackName: string = app.node.tryGetContext("stackName") ?? "TankGameRef";

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
};

const stack = new TankGameStack(app, stackName, {
  env,
  description: "Juego de tanques multijugador: CloudFront + ALB + ECS Fargate (1 tarea)",
  cloudFrontPrefixListId: app.node.tryGetContext("cloudFrontPrefixListId"),
});

Tags.of(stack).add("proyecto", "kiro-local-to-aws");
Tags.of(stack).add("stack", stackName);

// Roles de GitHub Actions (OIDC). Se despliega una vez: npx cdk deploy TankGameCi
const ci = new CiStack(app, "TankGameCi", {
  env,
  description: "Roles OIDC de GitHub Actions para desplegar y revisar PRs del juego de tanques",
  githubRepo: app.node.tryGetContext("githubRepo") ?? "JoseMP05/kiro-local-to-aws",
  githubSubPrefix:
    app.node.tryGetContext("githubSubPrefix") ?? "repo:JoseMP05@87217012/kiro-local-to-aws@1453512857",
});
Tags.of(ci).add("proyecto", "kiro-local-to-aws");
