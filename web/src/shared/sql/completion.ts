import { ifNotIn } from "@codemirror/autocomplete";
import { SQLite } from "@codemirror/lang-sql";

// Add phrases to the language's existing keyword and schema completion sources.
export const sqlPhraseCompletion = SQLite.language.data.of({
  autocomplete: ifNotIn(
    ["QuotedIdentifier", "String", "LineComment", "BlockComment", "."],
    context => {
      // Match only the current word: spaces in phrase labels must not consume
      // earlier SQL when CodeMirror chooses a replacement range.
      const word = context.matchBefore(/\w+$/);
      if (!word) return null;
      return {
        from: word.from,
        options: [
          "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "CROSS JOIN", "FULL OUTER JOIN",
          "GROUP BY", "ORDER BY", "UNION ALL", "IS NULL", "IS NOT NULL",
        ].map(label => ({ label, type: "keyword", boost: 10 })),
        validFor: /^\w*$/,
      };
    },
  ),
});
