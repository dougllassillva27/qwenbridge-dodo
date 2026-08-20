feat(qwenbridge): estabilização extrema, resgate anthropic e lazy load

- **Merge:** Atualização para o upstream (Julho/Agosto 2026), preservando telemetria Tauri, minimização de janelas, resolução 800x800 e métricas do Dodo.
- **Modelos [1M]:** Exposição automatizada de sufixo `[1M]` em `/v1/models` para suportar validação de UIs que injetam tag de longo contexto (ex: LibreChat).
- **Anthropic Adapter:** Resgatada a rota `/v1/messages` removida pelo upstream. Refatoração robusta do `translate.ts` para capturar `reasoning_content` da Qwen, envelopar em tags `<thinking>` e evitar drop de conexão (Timeout) no Cline/Roo Code durante o processamento.
- **RAM Optimization (Lazy Load):** Desativado o Boot Múltiplo (`PREPARE_ALL_ON_STARTUP=false`). O proxy inicia agora com apenas 1 browser (batch size = 1) eliminando engasgos pesados e o pico de RAM/CPU no arranque. A escala ocorrerá 100% on-demand.
- **Limpeza:** Logs reduzidos (`LOG_LEVEL=warn`) para não sobrecarregar I/O do disco local em modo de produção silencioso.
