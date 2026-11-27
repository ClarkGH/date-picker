/** Settings for `cem analyze`, which writes custom-elements.json from the source's JSDoc. */
export default {
  globs: ['src/index.ts', 'src/define.ts', 'src/date-picker.ts'],
  outdir: '.',
  litelement: true,
  plugins: [
    {
      // Private and #private members are implementation, not API. Editors would list them otherwise
      name: 'drop-private-members',
      packageLinkPhase({ customElementsManifest }) {
        for (const mod of customElementsManifest.modules) {
          for (const decl of mod.declarations ?? []) {
            if (decl.members) decl.members = decl.members.filter((m) => m.privacy !== 'private' && !m.name.startsWith('#'));
          }
        }
      },
    },
    {
      // define.ts registers with a constant, which the analyzer records by its name ("TAG_NAME").
      // Use the tag from the class's @tagname instead, so tools can match the tag to the class
      name: 'resolve-tag-constant',
      packageLinkPhase({ customElementsManifest }) {
        const tags = new Map();
        for (const mod of customElementsManifest.modules) {
          for (const decl of mod.declarations ?? []) if (decl.tagName) tags.set(decl.name, decl.tagName);
        }
        for (const mod of customElementsManifest.modules) {
          for (const exp of mod.exports ?? []) {
            if (exp.kind !== 'custom-element-definition' || exp.name.includes('-')) continue;
            const tag = tags.get(exp.declaration?.name);
            if (!tag) throw new Error(`No @tagname for ${exp.declaration?.name}, which ${mod.path} registers`);
            exp.name = tag;
          }
        }
      },
    },
  ],
};
