/**
 * One-off codemod: moves module-level static data out of route components into
 * `app/data/<domain>.ts`, using the TypeScript AST so ranges are exact.
 * Values are moved verbatim; the component keeps the same identifiers through
 * import aliases, so rendered output is unchanged.
 */
import ts from "typescript";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const APP = path.resolve("app");
const DATA = path.join(APP, "data");
const ROOTS = [path.join(APP, "routes", "protected")];

const STYLE_NAME = /(Class|Classes|Colors|Color|Styles|Style|Config|Icons|Icon|Border|typeColors)$/;

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
};

const files = ROOTS.flatMap(walk).sort();
const byDomain = new Map();
const report = [];

for (const file of files) {
  const rel = path.relative(path.join(APP, "routes", "protected"), file);
  const domain = rel.split(path.sep)[0];
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const fileKey = path
    .basename(file, ".tsx")
    .replace(/Page$/, "")
    .replace(/^./, (c) => c.toLowerCase());

  const removals = [];
  const moved = [];
  const importNodes = [];

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt)) {
      importNodes.push(stmt);
      continue;
    }

    if (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) {
      moved.push({
        kind: "type",
        name: stmt.name.text,
        text: stmt.getText(sf),
        start: stmt.getFullStart(),
        end: stmt.getEnd(),
      });
      removals.push([stmt.getFullStart(), stmt.getEnd()]);
      continue;
    }

    if (!ts.isVariableStatement(stmt)) continue;
    if (stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;

    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const name = decl.name.text;
      if (STYLE_NAME.test(name)) continue;
      const init = decl.initializer;
      if (!ts.isArrayLiteralExpression(init) && !ts.isObjectLiteralExpression(init)) continue;
      const text = init.getText(sf);
      // Anything that is a render tree, a function or a JSX fragment stays.
      if (/=>/.test(text) || /<[A-Za-z]/.test(text)) continue;

      moved.push({ kind: "const", name, text: stmt.getText(sf), start: stmt.getFullStart(), end: stmt.getEnd() });
      removals.push([stmt.getFullStart(), stmt.getEnd()]);
    }
  }

  if (moved.length === 0) continue;

  const entry = byDomain.get(domain) ?? { imports: new Map(), raw: new Set(), blocks: [] };
  for (const node of importNodes) {
    const from = node.moduleSpecifier.getText(sf);
    if (from.includes("+types")) continue;
    const clause = node.importClause;
    if (!clause) continue;
    const bucket = entry.imports.get(from) ?? new Map();
    if (clause.name) entry.raw.add(node.getText(sf));
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        bucket.set(el.name.text, el.isTypeOnly || clause.isTypeOnly);
      }
    }
    if (bucket.size) entry.imports.set(from, bucket);
  }

  const constAliases = [];
  const typeImports = [];
  for (const item of moved) {
    const exportName = `${fileKey}${item.name[0].toUpperCase()}${item.name.slice(1)}`;
    if (item.kind === "const") {
      const rewritten = item.text.replace(new RegExp(`^const\\s+${item.name}`), `export const ${exportName}`);
      entry.blocks.push(rewritten);
      constAliases.push([item.name, exportName]);
    } else {
      entry.blocks.push(item.text.replace(/^(interface|type)\s+/, "export $1 "));
      typeImports.push(item.name);
    }
  }

  byDomain.set(domain, entry);

  // Remove moved declarations (reverse order keeps offsets valid).
  let next = src;
  for (const [start, end] of removals.sort((a, b) => b[0] - a[0])) {
    next = next.slice(0, start) + next.slice(end);
  }

  const importLines = [];
  if (constAliases.length) {
    importLines.push(
      `import { ${constAliases.map(([local, exported]) => `${exported} as ${local}`).join(", ")} } from "@/data/${domain}";`,
    );
  }
  if (typeImports.length) {
    importLines.push(`import type { ${typeImports.join(", ")} } from "@/data/${domain}";`);
  }

  const insertAt = importNodes.length ? importNodes[importNodes.length - 1].getEnd() : 0;
  next = `${next.slice(0, insertAt)}\n${importLines.join("\n")}${next.slice(insertAt)}`;

  writeFileSync(file, next.replace(/\n{3,}/g, "\n\n"));
  report.push(`${rel}: ${moved.map((m) => m.name).join(", ")}`);
}

mkdirSync(DATA, { recursive: true });
for (const [domain, entry] of byDomain) {
  const header = [
    "/**",
    ` * Static ${domain} data, moved out of the route components.`,
    " * Each dataset is a plain const plus its shape, so it can be swapped for an",
    " * API-backed hook in one place.",
    " */",
    "",
  ];
  const body = entry.blocks.join("\n\n");
  const imports = [
    ...[...entry.imports.entries()].map(([from, names]) => {
      const named = [...names.entries()]
        .map(([name, isType]) => (isType ? `type ${name}` : name))
        .join(", ");
      return `import { ${named} } from ${from};`;
    }),
    ...entry.raw,
  ].join("\n");
  writeFileSync(path.join(DATA, `${domain}.ts`), `${header.join("\n")}${imports ? `${imports}\n` : ""}\n${body}\n`);
}

writeFileSync("data-migration-report.txt", report.join("\n") + "\n");
console.log(report.join("\n"));
