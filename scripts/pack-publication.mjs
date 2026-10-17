/** Compile every candidate before publishing; publication failures may leave earlier outputs committed. */
export async function compileBeforePublish(packs, compile, publish) {
  for (const pack of packs) await compile(pack);
  for (const pack of packs) await publish(pack);
}
