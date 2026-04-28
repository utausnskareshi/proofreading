/**
 * ルール定義の集約
 *
 * 各ルールは以下の形式で実装する：
 *   {
 *     id: 'rule-id',
 *     description: '説明',
 *     defaultSeverity: 'error' | 'warning' | 'info',
 *     run({ text, tokens, dictionaries }) -> Promise<Message[]>
 *   }
 *
 * Message: { ruleId, severity, message, index, length, fix?: { text } }
 *
 * 8カテゴリすべてをカバーするルールを実装。
 */

import { ruleDictionary } from './rule-dictionary.js';
import { ruleSentenceLength } from './rule-sentence-length.js';
import { ruleNoMixDearuDesumasu } from './rule-no-mix-dearu-desumasu.js';
import { ruleNoDoubledJoshi } from './rule-no-doubled-joshi.js';
import { ruleNoDoubledConjunction } from './rule-no-doubled-conjunction.js';
import { ruleRedundantExpression } from './rule-redundant-expression.js';
import { ruleMaxComma } from './rule-max-comma.js';
import { ruleNoSuccessiveWord } from './rule-no-successive-word.js';
import { ruleSubjectPredicate } from './rule-subject-predicate.js';
import { ruleHiraganaKeishikimeishi } from './rule-hiragana-keishikimeishi.js';
import { ruleAmbiguousExpression } from './rule-ambiguous-expression.js';
import { ruleNotationConsistency } from './rule-notation-consistency.js';
import { ruleBracketMatching } from './rule-bracket-matching.js';
import { ruleNumberFormat } from './rule-number-format.js';

import { getRuleSeverityOverride } from '../settings.js';

const _rules = [
  ruleDictionary,
  ruleNotationConsistency,
  ruleBracketMatching,
  ruleNumberFormat,
  ruleSentenceLength,
  ruleNoMixDearuDesumasu,
  ruleNoDoubledJoshi,
  ruleNoDoubledConjunction,
  ruleRedundantExpression,
  ruleMaxComma,
  ruleNoSuccessiveWord,
  ruleSubjectPredicate,
  ruleHiraganaKeishikimeishi,
  ruleAmbiguousExpression
];

// ユーザー設定で重要度上書き可能にしたラッパー
export const rules = _rules.map((rule) => ({
  ...rule,
  async run(ctx) {
    const found = await rule.run(ctx);
    const override = getRuleSeverityOverride(rule.id);
    return found.map((m) => ({
      ...m,
      severity: override ?? m.severity ?? rule.defaultSeverity ?? 'warning'
    }));
  }
}));

export const ruleMeta = _rules.map((r) => ({
  id: r.id,
  description: r.description,
  defaultSeverity: r.defaultSeverity ?? 'warning'
}));
