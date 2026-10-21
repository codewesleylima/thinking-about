# Agentes, interação e memória

Desde 0.4.0, `--allow-host-shell` é uma concessão de CMD/sh do host, independente das flags de ferramentas restritas. Perfis readonly e consultas da equipe sempre a reduzem; o coordenador conserva o perfil humano. A memória registra `hostShellUsed`, e a sessão não obtém verificação independente depois desse canal. Veja [execução](replicacao/05-CMD-E-EXECUCAO.md) e [ensino de continuidade](replicacao/03-CONTEXTO-E-CONTINUIDADE.md).

## Perfis

Perfis combinam nome, descrição, instruções e restrição `readOnly` no mesmo controlador. Não são subagentes concorrentes. Desde 0.3.0 são 19 perfis, incluindo engenharia, arquitetura, padrões, Java, depuração, engenharia reversa, frontend, testes, integrações, segurança, performance, dados, operação e documentação. `reviewer`, `researcher` e `security` negam escrita/execução mesmo com `--allow-write --allow-exec`. Consulte o [catálogo e a orquestração](codex/04-EQUIPE-E-ORQUESTRACAO.md).

`yzzy team plan "objetivo"` mostra uma seleção heurística sem inferência. `yzzy team run "objetivo" --specialists java,tester` abre consultas sequenciais de leitura e uma síntese pelo coordenador. O orçamento é agregado, os pareceres têm autoria e o coordenador é o único que pode implementar quando autorizado. `/team <objetivo>` abre esse fluxo no chat. Equipes não incluem implicitamente o histórico anterior e suas sessões não são retomadas isoladamente, pois isso alteraria o orçamento compartilhado. Consulte a pergunta no relatório e inicie nova equipe com a informação necessária.

```bat
yzzy agent list
yzzy agent show coder
yzzy agent create arquiteto --instructions "Analise dependências e explique decisões com exemplos." --read-only
yzzy agent create auditor --from reviewer --instructions-file C:/instrucoes/auditor.txt
yzzy agent edit arquiteto --instructions "Explique alternativas e riscos citando arquivos."
yzzy --agent arquiteto
```

`--from` herda descrição e restrição; forneça novas instruções explicitamente. Perfis internos não podem ser sobrescritos. Nomes começam por letra minúscula, usam letras, números, `_` e `-`, até 40 caracteres. Instruções têm até 16000 bytes. `.yzzy/agents.json` armazena o catálogo com validação, lock e escrita atômica; ferramentas do modelo não podem editá-lo.

No chat, `/agents` lista e `/agent nome` seleciona em nova sessão. `YZZY.md` da raiz fornece orientação comum congelada e subordinada à política. Não há descoberta recursiva de instruções ou scripts de perfil executáveis.

## Preferências e dúvidas

```bat
yzzy settings set language pt-BR
yzzy settings set verbosity detailed
yzzy settings set tone friendly
yzzy settings set clarification essential
yzzy settings set autoSummary true
yzzy settings show
```

| Chave | Valores | Padrão |
|---|---|---|
| `language` | Texto de 1 a 40 caracteres | `pt-BR` |
| `verbosity` | `concise`, `balanced`, `detailed` | `balanced` |
| `tone` | `direct`, `friendly`, `formal` | `direct` |
| `clarification` | `essential`, `always`, `assume` | `essential` |
| `autoSummary` | Booleano `true` ou `false` | `true` |

`essential` pergunta quando faltar informação relevante que não puder ser inferida com segurança. `always` pede esclarecimento ou confirmação de entendimento antes de mudança relevante. `assume` favorece suposições explícitas para decisões reversíveis já autorizadas, mantendo dúvidas relevantes e efeitos externos sujeitos a esclarecimento. São instruções comportamentais ao modelo, não garantias nem permissões adicionais.

`ask_user` suspende em `waiting_user`. A próxima mensagem do chat ou `resume` responde sem reiniciar contadores. Preferências ficam em `.yzzy/preferences.json` por workspace. `/settings` mostra e `/set chave valor` altera em nova sessão.

## Histórico e retomada

```bat
yzzy history
yzzy inspect <id>
yzzy summary <id>
yzzy resume <id>
yzzy resume <id> "A regra correta inclui 18 anos."
yzzy export <id> --output conversa.md
```

O journal em `.yzzy/sessions/` mantém mensagens, ferramentas, resultados, decisões e checkpoints. A cadeia de hashes detecta inconsistências; não autentica contra alguém capaz de reescrever tudo. A exportação inclui mensagens humanas e respostas públicas, aplica redação e não sobrescreve arquivos. Revise antes de compartilhar.

A retomada usa snapshots congelados de perfil/preferências e exige mesmo workspace, configuração, runtime e permissões efetivas. Flags de escrita/execução devem coincidir. Atualizar runtime ou configuração exige nova sessão. O prazo padrão é absoluto de 15 minutos desde a criação, incluindo espera humana; há 24 propostas por sessão. `/new` abre outra sessão. Ajustar limites também exige nova sessão.

Não há replay de ferramenta pendente após crash. Efeito ou limpeza incerta exige inspeção e nova sessão. Um lock antigo requer conferir PID antes de remover o arquivo específico. Os guardrails de retomada continuam ativos.

## Resumo e compactação

`summary` e `/summary` geram resumo **extrativo local**, sem inferência adicional: objetivo, todas as instruções humanas literais, agente, permissões, arquivos alterados/hashes, referências de evidência, últimos erros/respostas, efeitos incertos e recursos. Não há embeddings, aprendizado de pesos ou resumo semântico por LLM.

A partir de oito mensagens e 70% do teto de bytes, `autoSummary` envia resumo e quatro blocos recentes para a próxima inferência. Blocos mantêm proposta e resultados juntos. `/compact` força essa projeção no próximo turno a partir de oito mensagens. O histórico completo permanece intacto e `context_compacted` registra a operação.

O resumo não concede autoridade. Requisitos humanos, permissões, recursos e incerteza permanecem explícitos. Detalhes antigos de arquivos podem ser perdidos; releia antes de editar. Se a projeção ainda exceder o limite total, a admissão bloqueia a chamada. Instruções humanas longas não são truncadas silenciosamente. Os testes verificam essas propriedades, sem prometer equivalência semântica perfeita ao histórico integral.
