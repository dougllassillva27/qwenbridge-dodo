import { StreamingToolParser } from "./src/tools/parser.ts";

const text1 = `Problema: o símbolo % dentro do bloco (LTrim) é interpretado como variável pelo AHK. Vou escapar com crase: 100\`\`%.\n\n<tool_ca`;
const text2 = `ll>
{"name":"Edit","arguments":{"file_path":"D:\\\\Onedrive - Douglas\\\\OneDrive\\\\Pessoal\\\\Dodo\\\\Programacao\\\\Git\\\\AutoHotkey\\\\ahk-dashboard\\\\_contexto-ia\\\\Geral2.md","new_string":"; Exemplo ERRADO: Quero que voce entregue 100\`\`% do codigo.\\n; Exemplo CERTO:  Quero que voce entregue 100\`\`\`\`% do codigo.","old_string":"; Exemplo ERRADO: Quero que voce entregue 100% do codigo.\\n; Exemplo CERTO:  Quero que voce entregue 100\`\`% do codigo."}}
</tool_call>`;

const parser = new StreamingToolParser([]);
let allText = "";
let res = parser.feed(text1);
if (res.text) allText += res.text;

res = parser.feed(text2);
if (res.text) allText += res.text;

const flushRes = parser.flush();
if (flushRes.text) allText += flushRes.text;

console.log("Emitted text:", allText);
console.log("Emitted tools:", parser.getEmittedToolCallCount());
