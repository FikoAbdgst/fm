// Evaluator kondisi aman tanpa eval(). Mendukung:
//   perbandingan: >= <= > < == !=
//   logika: && ||
//   literal: angka, string kutip satu, path seperti soldCount atau player.tier
function getPath(scope, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), scope);
}

function parseValue(token, scope) {
  const t = token.trim();
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1);
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return getPath(scope, t);
}

function evalCompare(expr, scope) {
  const m = expr.match(/^(.*?)(>=|<=|==|!=|>|<)(.*)$/);
  if (!m) {
    const v = parseValue(expr, scope);
    return Boolean(v);
  }
  const left = parseValue(m[1], scope);
  const right = parseValue(m[3], scope);
  switch (m[2]) {
    case '>=': return left >= right;
    case '<=': return left <= right;
    case '>': return left > right;
    case '<': return left < right;
    case '==': return left == right;
    case '!=': return left != right;
    default: return false;
  }
}

export function evalCondition(expr, scope) {
  if (typeof expr !== 'string' || !expr.trim()) return false;
  const ors = expr.split('||');
  for (const orPart of ors) {
    const ands = orPart.split('&&');
    let all = true;
    for (const part of ands) {
      if (!evalCompare(part, scope)) { all = false; break; }
    }
    if (all) return true;
  }
  return false;
}
