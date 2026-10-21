# Codex como inferência da YZZY BLACK

## Integração e autenticação

A versão 0.2.0 usa `@openai/codex@0.163.0`. O [App Server](https://learn.chatgpt.com/docs/app-server) oferece protocolo estruturado por stdio, evitando interpretar telas interativas. A dependência é fixada porque a interface experimental pode mudar. Os schemas do executável instalado foram usados para conferir campos e enums; documentação mais recente pode descrever outro contrato.

O produto fornece controlador, perfis, memória, ferramentas e política próprios. O modelo continua sendo fornecido pela OpenAI. Perfis alteram instruções e restrições; não alteram pesos. Responses e Ollama permanecem alternativas substituíveis.

`yzzy login` chama o fluxo oficial de [autenticação](https://learn.chatgpt.com/docs/auth); `--device-auth` usa o fluxo de dispositivo. `yzzy login status` verifica a sessão. O processo herda `CODEX_HOME` ou usa `.codex` na pasta do usuário. Não extraímos, copiamos ou registramos tokens. `account/read` exige conta autenticada antes de gerar propostas.

`yzzy models` lista o catálogo; `--model <id>` escolhe um identificador retornado. `model` vazio usa o padrão atual do Codex. Disponibilidade e cota dependem da conta. `doctor` consulta versão/status sem inferência. `npm.cmd run test:codex` faz inferência mínima; `npm.cmd run test:codex:edit` edita uma fixture e verifica em Docker; `npm.cmd run test:codex:cli` exercita perfil, pergunta e retomadas entre processos. São testes reais e consomem cota.

## Protocolo e autoridade

1. O controlador valida perfil, concessões, contexto e recursos.
2. O adaptador inicia diretamente `codex app-server --listen stdio://`, sem shell, em diretório temporário vazio.
3. Executa `initialize`, `initialized`, consulta a conta e lê configuração efetiva sem registrá-la.
4. Cria thread efêmera com `sandbox:read-only` e `approvalPolicy:never`. Desabilita shell, hooks, apps, plugins, subagentes, web e outras capacidades nativas fora do contrato. MCPs do usuário são desabilitados na thread; nomes ambíguos são recusados.
5. Envia histórico projetado e catálogo em `turn/start`, com `outputSchema` para `{text,calls}`, no máximo uma ferramenta por resposta, argumentos em string JSON.
6. Aguarda conclusão íntegra e valida a proposta. O host atribui IDs e aplica seus validadores antes de executar ferramentas.
7. Fecha o processo. A proposta seguinte recebe outra thread, com continuidade fornecida pelo journal da YZZY.

O sandbox de leitura restringe ações NATIVAS do Codex. Propostas JSON são executadas pelo host segundo as concessões humanas: `allowWrite=true` autoriza propor `replace_text` dentro do escopo. Essa distinção é explícita nas instruções e foi necessária no teste real de edição.

Solicitações nativas de aprovação são negadas. Eventos inesperados de execução nativa interrompem a integração. Não há fallback para bypass de sandbox, shell livre ou troca silenciosa de backend.

## Fronteiras e limites

O executável nativo e seu acesso ao cache oficial de autenticação fazem parte da base de confiança. Diretório vazio, configuração e monitoramento são defesas de integração; não constituem isolamento de SO de todo o controlador nem prova de ausência de efeitos num backend defeituoso. O schema desta versão não permite declarar uma allowlist de raízes de leitura como confinamento absoluto. Use uma VM quando o host inteiro exigir isolamento de processos não confiáveis.

Continuamos limitando bytes de contexto/saída, propostas, ferramentas, prazo e efeitos no host. `maxModelCalls` conta invocações do adaptador, não requisições internas do produto. `maxOutputTokens` é aplicado pelos adaptadores HTTP, sem mapeamento artificial ao App Server. O journal registra uso disponível e `billing:managed_by_codex`: `spent:0` significa ausência de contabilidade financeira local, **não gratuidade**. `pricing` e `maxCostMicrousd` não impõem teto financeiro no backend Codex.

Reabrir processo e reenviar histórico a cada proposta acrescenta latência e tokens. Não há streaming de texto no terminal: a resposta aparece após validação completa, enquanto eventos operacionais mostram progresso. Não registramos raciocínio privado. Diretórios temporários vazios podem permanecer; o histórico fica em `.yzzy/` e a retenção do serviço segue as condições da conta.

Antes de atualizar a dependência, gere schemas, confira enums, rode testes simulados e repita inferência/edição reais. `src/codex-rpc.js` trata JSONL, correlação, deadlines e recusa de solicitações nativas. `src/codex-provider.js` adapta propostas e opções. Não transfira autorização do controlador para instruções do modelo ao substituir esse adaptador.
