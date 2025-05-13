export const isDev = Deno.env.get("IS_DEV") === "true";

export const CREDIT_UPDATE_MAP = {
  // test
  pdt_EPApEZiWdChI8C5MtLNwJ: 60,
  pdt_GQ8yH98j1AsI3mG2u4bOQ: 160,
  pdt_BA3N52wCAWroEoky8HwNz: 320,

  // prod
  pdt_LAvfGR7qU7Xkf83fDmYxd: 60,
  pdt_2v8W0s7zDPsU3GkrhFMEI: 160,
  pdt_fPXoHnNr9AYemVwqOS8Tq: 320,

  // mock production
  pdt_njNQLgxzfhm5NR1xDQUPc: 10,
};
