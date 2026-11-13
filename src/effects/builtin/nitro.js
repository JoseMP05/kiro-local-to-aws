// Efecto nitro: como el turbo pero con un empujón aleatorio para que sea más divertido.

export function createNitroEffect() {
  return {
    name: "nitro",
    create() {
      return {
        onActivate(ctx) {
          const boost = 1.5 + Math.random();
          ctx.setSpeedMultiplier(boost);
        },
        onEnd(ctx) {
          ctx.setSpeedMultiplier(2);
        },
      };
    },
  };
}
