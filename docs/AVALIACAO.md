# Avaliação reproduzível

## Níveis de evidência

| Execução | O que mede | O que não mede |
|---|---|---|
| `npm.cmd test` | Invariantes, falhas injetadas e contratos de adaptadores com HTTP simulado | Qualidade do modelo e isolamento Docker real |
| `npm.cmd run evaluate` | Oito cenários determinísticos, incluindo controle negativo | Taxa de sucesso de um LLM em tarefas diversas |
| `npm.cmd run test:docker` | Fronteiras do container real e remoção após timeout | Segurança formal contra escapes de kernel |
| `npm.cmd run test:live` | Uma tarefa com modelo real + grader independente em Docker | Benchmark representativo ou comparação comercial |

Os testes da implementação são próprios e separados dos 22 testes do laboratório embutido no estudo original. Resultados de um nível não substituem outro. O [relatório de validação](VALIDACAO.md) registra o que realmente foi executado nesta entrega.

## Reprodução offline

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd test
npm.cmd run check
npm.cmd run evaluate
node bin/wzzy.js demo --json
```

`evaluations/tasks.json` contém 24 especificações de desenvolvimento. O campo `automated` informa se a tarefa é exercitada no runner offline, testes unitários, smoke Docker ou se ainda é uma proposta. Oito cenários são executados pelo runner; os outros não devem ser contados como oito ou vinte e quatro soluções de um modelo.

O relatório gerado em `evaluations/results/latest.json` contém status por cenário, chamadas, duração, custo, modelo roteirizado e hashes do harness, instruções, schema e manifesto. É ignorado pelo Git para não versionar trajetórias locais; o CI o publica como artefato. O controle positivo deve corrigir a regra e o negativo deve reprovar o código original. Isso verifica que o grader consegue detectar pelo menos o defeito conhecido.

O campo `passed` contabiliza a conformidade do controlador ao cenário, incluindo bloqueios esperados. Não significa que um modelo resolveu aquele número de tarefas. Não se publica intervalo de confiança binomial para generalizar uma seleção determinística de cenários.

## Smoke com modelo real

Configure modelo e, se aplicável, preços/chave. Prepare Docker e a imagem. Depois:

```powershell
$env:WZZY_LIVE = "1"
npm.cmd run test:live
```

O opt-in autoriza as chamadas do provedor escolhido dentro dos limites configurados. O script cria uma fixture temporária e pede ao modelo a correção. Um comando de verificação controlado pelo avaliador testa as fronteiras 0, 17, 18, 19 e 99 em Docker, independentemente do texto final do agente. Seu código é fornecido ao executor por configuração do controlador, sem arquivo de grader editável no workspace. Há um teste pós-execução mesmo se o modelo não chamar `run_check`.

Registre stdout, configuração sem credenciais, fingerprint, ID da sessão, modelo resolvido, gasto e saldo retido. Um único smoke é um diagnóstico de integração; não estime generalização a partir dele. O custo da chamada e o consentimento para envio de código pertencem ao ambiente do operador.

## Protocolo para medir qualidade

Antes de comparar modelos/harnesses, congele tarefas, regras de sucesso, restrições, preço, orçamento, imagem por digest, número de tentativas e política de intervenções. Forme um conjunto privado separado do desenvolvimento, incluindo múltiplos repositórios e linguagens. D09–D12 e D23–D24 são propostas para ampliar diversidade, ainda sem fixtures executáveis neste repositório.

Defina sucesso como funcionalidade atendida, ausência de regressões detectadas, restrições respeitadas e avaliador íntegro. Avalie patches com testes sob controle independente, sem deixar o agente escolher a melhor tentativa retrospectivamente. Registre falhas de infraestrutura e não as exclua sem critério prévio.

Compare baseline e candidato nas mesmas tarefas. Reporte sucesso por tarefa, custo total por solução válida, latência, intervenções, regressões e violações. Para amostras estocásticas, use análise pareada com reamostragem por tarefa/repositório, preservando tentativas agrupadas. Intervalos de Wilson só são apropriados para proporções sob hipóteses declaradas; tentativas da mesma tarefa não equivalem a tarefas independentes. O método é discutido no [NIST](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm) e na seção 27 do estudo.

Não foi executada comparação com Codex, Claude Code, Copilot ou Devin nesta implementação. A avaliação não concede equivalência comercial nem certificação de segurança.
