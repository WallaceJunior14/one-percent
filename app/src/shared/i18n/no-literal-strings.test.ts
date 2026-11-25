import ts from 'typescript';

/**
 * Guarda para que os textos da interface venham do catálogo (`pt-BR.ts`).
 *
 * Varre todos os `.tsx` de `src/` (exceto testes e o próprio catálogo) e acusa:
 *  - texto escrito entre as tags do JSX;
 *  - string literal (ou template) com letras dentro de uma expressão `{...}` filha do JSX,
 *    como `{ok ? 'Salvo' : 'Salvar'}`; comparações (`=== 'x'`) são ignoradas;
 *  - atributo cujo nome sugere texto (`label`, `title`, `hint`, `message`, `saveLabel`...)
 *    com string literal ou template, direto ou dentro de uma expressão.
 *
 * Não cobre: textos fora do JSX (ex.: constantes, `Alert`), props de texto com nomes que
 * fogem do padrão e literais sem letras (como "✓" ou "+"). Esses casos ficam para a revisão de código.
 */

// O projeto não instala os tipos do Node: só o que este teste usa está declarado aqui.
type DirEntry = { name: string; isDirectory(): boolean };
/* eslint-disable @typescript-eslint/no-require-imports */
const fs: {
  readdirSync(dir: string, options: { withFileTypes: true }): DirEntry[];
  readFileSync(file: string, encoding: 'utf8'): string;
} = require('fs');
const path: {
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;
  relative(from: string, to: string): string;
} = require('path');
/* eslint-enable @typescript-eslint/no-require-imports */
declare const __dirname: string;

const SRC = path.resolve(__dirname, '..', '..');
const ROOTS = [SRC];
const CATALOG_DIR = path.join(SRC, 'shared', 'i18n');
// Nome de prop que costuma carregar texto: label, title, saveLabel, accessibilityHint, message...
const TEXT_ATTRIBUTE = /label|title|text|hint|placeholder|message|subtitle/i;
const HAS_LETTER = /\p{L}/u;

function listComponentFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (full === CATALOG_DIR) return [];
    if (entry.isDirectory()) return listComponentFiles(full);
    return full.endsWith('.tsx') && !/\.test\.tsx$/.test(full) ? [full] : [];
  });
}

function isLiteralWithLetters(node: ts.Node): boolean {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return HAS_LETTER.test(node.text);
  }
  if (ts.isTemplateHead(node)) return HAS_LETTER.test(node.text);
  if (ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) return HAS_LETTER.test(node.text);
  return false;
}

const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

const isComparisonOperand = (node: ts.Node) =>
  ts.isBinaryExpression(node.parent) && COMPARISONS.has(node.parent.operatorToken.kind);

/** Percorre `root` sem entrar em atributos JSX (tratados à parte). */
function collectLiterals(root: ts.Node, found: ts.Node[]) {
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node)) return;
    if (isLiteralWithLetters(node) && !isComparisonOperand(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
}

export function findLiteralStrings(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const problems: string[] = [];
  const report = (node: ts.Node, text: string) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    problems.push(`${path.relative(SRC, fileName)}:${line + 1} "${text.trim()}"`);
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && HAS_LETTER.test(node.text)) report(node, node.text);

    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent) && node.expression) {
      const found: ts.Node[] = [];
      collectLiterals(node.expression, found);
      found.forEach((literal) => report(literal, literal.getText(file)));
    }

    if (
      ts.isJsxAttribute(node) &&
      TEXT_ATTRIBUTE.test(node.name.getText(file)) &&
      node.initializer
    ) {
      const found: ts.Node[] = [];
      collectLiterals(node.initializer, found);
      found.forEach((literal) => report(literal, literal.getText(file)));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return [...new Set(problems)];
}

it('flags_literal_text_in_jsx', () => {
  const sample = [
    'const A = () => <Text>Olá</Text>;',
    'const B = () => <Pill label="Voltar" />;',
    "const C = () => <Text>{ok ? 'Salvo' : 'Salvar'}</Text>;",
    'const D = () => <View accessibilityLabel={`Ler: ${x}`} />;',
  ].join('\n');
  expect(findLiteralStrings('sample.tsx', sample)).toHaveLength(5);
});

it('flags_literal_text_in_custom_text_props', () => {
  const sample = [
    'const A = () => <ReminderScreen saveLabel="Começar" />;',
    'const B = () => <View accessibilityHint="Abre o card" />;',
    "const C = () => <Screen saveLabel={fromOnboarding ? 'Começar' : 'Salvar'} />;",
  ].join('\n');
  expect(findLiteralStrings('sample.tsx', sample)).toHaveLength(4);
});

it('ignores_catalog_text_and_comparisons', () => {
  const sample = [
    'const A = () => <Text>{t.common.back}</Text>;',
    "const B = () => <View key={id ?? 'all'}>{kind === 'ready' && <Pill label={t.x} />}</View>;",
    "const C = () => <Text>{' '}</Text>;",
  ].join('\n');
  expect(findLiteralStrings('sample.tsx', sample)).toEqual([]);
});

it('has_no_literal_strings_in_components', () => {
  const problems = ROOTS.flatMap(listComponentFiles).flatMap((file) =>
    findLiteralStrings(file, fs.readFileSync(file, 'utf8')),
  );
  expect(problems).toEqual([]);
});
