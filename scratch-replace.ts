import fs from "fs";

const file = "src/routes/chat/streaming.ts";
let code = fs.readFileSync(file, "utf8");

code = code.replace(/reasoningBuffer = "";/g, "reasoningBuffer.length = 0;");
code = code.replace(/assistantContent: finalContent,/g, 'assistantContent: finalContent.join(""),');
code = code.replace(/assistantContent: finalContent\n/g, 'assistantContent: finalContent.join(""),\n');
code = code.replace(/assistantContent: finalContent\r\n/g, 'assistantContent: finalContent.join(""),\r\n');

// Also handle reasoningBuffer reassignments
code = code.replace(/reasoningBuffer \+= (.*?);/g, "reasoningBuffer.push($1);");
code = code.replace(/reasoningBuffer = (.*?);/g, "reasoningBuffer.length = 0; reasoningBuffer.push($1);");

// And ensure we catch all missing `assistantContent: finalContent`
code = code.replace(/assistantContent:\s*finalContent(?!.join)/g, 'assistantContent: finalContent.join("")');
code = code.replace(/reasoningContent:\s*reasoningBuffer(?!.join)/g, 'reasoningContent: reasoningBuffer.join("")');

fs.writeFileSync(file, code);
console.log("Done");
