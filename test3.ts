import { StreamingToolParser } from "./src/tools/parser.ts";

const text = `Problema: o símbolo % dentro do bloco (LTrim) é interpretado como variável pelo AHK. Vou escapar com crase: 100\`\`%.

<tool_call>
{"name":"Edit","arguments":{"file_path":"D:\\\\Onedrive - Douglas\\\\OneDrive\\\\Pessoal\\\\Dodo\\\\Programacao\\\\Git\\\\AutoHotkey\\\\ahk-dashboard\\\\_contexto-ia\\\\Geral2.md","new_string":"; Exemplo ERRADO: Quero que voce entregue 100\`\`% do codigo.\\n; Exemplo CERTO:  Quero que voce entregue 100\`\`\`\`% do codigo.","old_string":"; Exemplo ERRADO: Quero que voce entregue 100% do codigo.\\n; Exemplo CERTO:  Quero que voce entregue 100\`\`% do codigo."}}
</tool_call>`;

const parser = new StreamingToolParser([]);
let allText = "";
for(let i=0; i<text.length; i++) {
  const result = parser.feed(text[i]);
  if (result.text) allText += result.text;
}
const result = parser.flush();
if (result.text) allText += result.text;

console.log("Emitted text:", allText);
console.log("Emitted tools:", parser.getEmittedToolCallCount());
