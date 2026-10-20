# Validação da WZZY AI 0.1.0

Data: **20/10/2026**, America/Sao_Paulo. Ambiente local: Windows, Node.js **v24.19.0**, npm **11.17.0**, Docker Engine **29.6.1** com containers Linux.

Este registro descreve observações desta implementação. Os testes do laboratório do estudo original não foram reapresentados como resultados da WZZY AI.

| Verificação | Resultado observado |
|---|---|
| Suíte `node --test` | 43 testes aprovados; sem falhas ou testes ignorados |
| Sintaxe e JSON | 24 módulos JavaScript e arquivos JSON validados |
| Cenários determinísticos | 8/8 conformes, incluindo controle positivo e negativo |
| Demonstração da CLI | Corrigiu o limite de maioridade e passou no grader independente |
| Sessões | Listagem/inspeção, perguntas, retomada e limites persistentes exercitados |
| Concorrência e arquivo | Hash obsoleto rejeitado, alteração humana preservada, CRLF/BOM e replacement literal preservados |
| Política | Traversal, nomes reservados, symlink/junction, hardlink, segredos conhecidos e escrita sem concessão rejeitados |
| Adaptadores OpenAI/Ollama | Schemas, formatos, correlação, uso e falhas testados com respostas HTTP simuladas |
| Docker real | UID restrito, raiz/projeto somente leitura, ausência de credencial e arquivo `.env`, rede externa indisponível |
| Timeout Docker real | Processo e filho encerrados pela remoção do container; limpeza confirmada |
| Containers restantes | Nenhum container `wzzy-*` após a bateria real |
| Empacotamento | `npm pack --ignore-scripts`, extração em diretório temporário e execução da demo do pacote |
| Inferência com modelo real | Não executada: servidor Ollama/modelo e credencial de API ausentes no ambiente inicial |
| CI remoto em três sistemas | Configurado; não apresentado como execução observada localmente |

Imagem oficial utilizada, fixada na configuração e no CI:

```text
node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
```

Na bateria real com essa imagem, as sondas de filesystem/rede/identidade/credenciais terminaram com exit code 0 em aproximadamente 590 ms. O teste deliberadamente interminável, que também criou um filho, atingiu o prazo de 1000 ms; o cliente retornou em aproximadamente 1032 ms e o container foi removido. Esses tempos são observações da máquina, não SLA.

O acesso ao daemon foi validado em execução autorizada fora do sandbox do editor. Dentro do sandbox, `doctor` detectou corretamente erro de acesso ao pipe; isso não foi interpretado como falha no mecanismo Docker nem ocultado como integração aprovada.

## Como reproduzir

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd test
npm.cmd run check
npm.cmd run evaluate
npm.cmd run test:docker
npm.cmd pack --ignore-scripts
npm.cmd run test:package
```

O digest deve estar preparado no Docker; consulte [configuração](CONFIGURACAO.md). `evaluations/results/latest.json` registra hashes dos módulos, schema, instrução e manifesto, plataforma e resultados. Novas execuções substituem esse relatório local ignorado pelo Git. A cadeia de eventos de cada fixture fica no diretório temporário impresso ou identificado no relatório.

## Limites da conclusão

Há evidência de funcionamento do controlador, CLI, ferramentas, empacotamento e isolamento nas condições ensaiadas. **Não há evidência de qualidade geral de programação de um LLM**, pois a inferência real não foi executada nesta sessão. Os adaptadores estão implementados, com contratos validados, e o [smoke real](AVALIACAO.md) está disponível após configuração do modelo.

Não foi realizado pré-treinamento/fine-tuning, auditoria formal, benchmark competitivo, teste de carga multiusuário nem validação local de Linux/macOS. A versão é uma base funcional para piloto controlado. `checks_passed` significa que verificações cadastradas passaram na revisão observada; somente avaliação independente com critérios de tarefa pode sustentar uma alegação mais ampla.
