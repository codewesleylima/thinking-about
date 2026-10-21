# 5. CMD, comandos livres e fronteiras de execução

## 5.1 A capacidade solicitada

A versão 0.4.0 oferece `run_command`, habilitada por `--allow-host-shell`. O objetivo é permitir que uma sessão autorizada utilize comandos reais do ambiente: CMD no Windows e `sh` em POSIX, incluindo programas instalados, pipes e redirecionamentos. A implementação está em [host-shell.js](../../src/host-shell.js).

O modo padrão permanece restrito. `--allow-exec` autoriza checks cadastrados no Docker e não habilita shell do host. `--allow-host-shell` é uma concessão separada e mais ampla, suficiente para o shell operar com os direitos do usuário mesmo se `--allow-write` e `--allow-network` das ferramentas específicas estiverem desligadas. Não há uma promessa de confinamento equivalente entre esses modos.

## 5.2 Escolher conscientemente o ambiente

| Característica | `run_check` | `run_command` |
| --- | --- | --- |
| Entrada | Nome de comando cadastrado | Texto de comando e cwd inicial. |
| Interpretação | `argv` do operador | Sintaxe de CMD/sh. |
| Local | Container Docker | Host do usuário. |
| Arquivos | Snapshot filtrado e readonly | Acesso do usuário, inclusive fora da raiz. |
| Rede | Desabilitada no container | Rede disponível ao processo do usuário. |
| Dependências | Imagem/caches preparados | Programas instalados e ambiente do host. |
| Efeito | Execução sobre snapshot | Pode editar, instalar, iniciar processos e agir externamente. |
| Resultado | Evidência de check ligada à revisão | Diagnóstico; não avaliação independente. |
| Autorização | `--allow-exec` | `--allow-host-shell`. |

Uma denylist de verbos não confina uma linguagem de shell que pode chamar interpretadores, scripts e programas arbitrários. `cwd` escolhe onde começar, não onde o processo está autorizado tecnicamente a permanecer. Para executar código não confiável, mantenha o worker isolado ou implemente uma sandbox apropriada de sistema operacional.

## 5.3 Uso no CMD

```bat
yzzy --agent java --allow-host-shell
yzzy run "Confira a versão do Java e diagnostique o build local autorizado" --agent java --allow-host-shell
yzzy team run "Investigue a falha descrita no projeto e aplique a correção" --specialists java,debugger,tester --allow-host-shell
```

A sessão não pede confirmação para cada comando dentro dessa concessão. O agente deve continuar respeitando o pedido humano e não criar efeitos externos alheios à tarefa. O host não consegue deduzir todos esses efeitos apenas lendo a string do comando; essa é uma sessão de confiança mais alta.

Perfis `reviewer`, `researcher` e `security` continuam sem shell. Consultas da equipe sempre perdem essa capacidade, mesmo que o coordenador a tenha. O perfil de origem do usuário também reduz a autoridade da equipe; trocar para coordenador não amplia um perfil somente leitura.

## 5.4 Contrato de chamada

Exemplo ilustrativo no Windows:

```json
{
  "name": "run_command",
  "args": {
    "command": "java -version",
    "cwd": "."
  }
}
```

`command` exige texto não vazio, até 16.000 bytes e sem NUL. `cwd` é `.` para a raiz ou um diretório relativo permitido pelo validador do workspace. Essa validação impede iniciar diretamente em um caminho proibido pelo contrato, mas não impede o comando de mudar de diretório depois.

O Windows usa o CMD do diretório de sistema. A invocação via `spawn` com shell explícito é a capacidade intencional, não uma concatenação de texto de usuário em um comando administrativo oculto. O programa não eleva para administrador. `stdin` fica fechado; comandos interativos que exigem senha, TTY ou confirmação não são suportados como sessões de terminal completas.

A sintaxe de CMD e seus parâmetros é documentada pela [Microsoft](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd); o lifecycle e o uso de shell são descritos pelo [Node.js 24.19.0](https://nodejs.org/download/release/v24.19.0/docs/api/child_process.html). Nossa escolha de interface e política é própria.

## 5.5 Dados de ambiente

O executor preserva variáveis de toolchain como PATH/JAVA_HOME e remove variáveis com nomes reconhecidos como KEY, TOKEN, SECRET, PASSWORD e opções Node que alterariam o processo filho. Isso reduz herança acidental de credenciais conhecidas.

Não é isolamento de segredos. O shell do mesmo usuário pode acessar arquivos de credencial, serviços locais e variáveis com nomes não reconhecidos, ou programas que possuam autenticação própria. Nem essa filtragem nem a redação do journal garante remover todo segredo arbitrário. A autorização do host deve ser dada somente em um ambiente apropriado ao trabalho.

## 5.6 Lifecycle e cancelamento

Antes da execução, o controlador registra política e início da ferramenta. O processo tem prazo por `commandTimeoutMs`, combinado com cancelamento e deadline da sessão. Capturamos stdout/stderr, exit code, duração e saída limitada; o limite final considera a serialização JSON com escapes.

No Windows tentamos encerrar a árvore do filho pelo PID exato com `taskkill /pid ... /t /f`. Em POSIX tentamos encerrar o grupo de processos. São mecanismos de cleanup, não uma sandbox. A referência de parâmetros Windows está em [taskkill](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill).

Após interrupção há uma tolerância curta de limpeza. O executor não espera indefinidamente por pipes de descendentes. Ele marca a limpeza como incerta quando interrompido, mesmo que a tentativa de kill tenha sucesso: processos destacados, serviços e efeitos remotos podem sobreviver. Não garantimos controle de todos os descendentes sem Job Objects, cgroups, containers ou outro supervisor apropriado.

O resultado incerto bloqueia a sessão e impede replay automático. Inspecione arquivos, processos e serviços afetados antes de nova tentativa. O comando original pode ter feito parte do trabalho; timeout não desfaz uma publicação ou instalação já iniciada.

## 5.7 Exit code, erro e evidência

Um comando que retorna 7 terminou com falha conhecida; ele pode ter produzido efeitos parciais. O modelo deve analisar a saída e formular próximo experimento. Não há retry automático. A detecção de repetição e os limites globais continuam aplicados.

Saída truncada não sustenta uma conclusão que depende da parte omitida. Comandos devem ser menores, usar filtros ou produzir artefatos autorizados que possam ser lidos de forma delimitada. A saída de um programa continua sendo dado não confiável e pode conter instruções maliciosas.

Após qualquer uso do shell, o runtime não concede `verified` por avaliador injetado nem promove checks aprovados a uma conclusão independente: a sessão permanece `completed_unverified`, preservando `failed` quando existe evidência de check reprovado. Isso não diz que a operação falhou; diz que esse canal amplo não fornece a independência assumida pelo avaliador controlado.

## 5.8 Java e outras ferramentas do host

Com JDK e build tool instalados, um agente pode executar comandos da toolchain e analisar saídas reais. Cada projeto precisa confirmar versão e diretório. Wrappers Maven/Gradle podem baixar distribuições e dependências; no host confiável isso usa a rede disponível e produz efeitos no cache do usuário.

O perfil Java não instala automaticamente JDK, Maven, Gradle, decompilador ou debugger. Ele também não transforma um attach a produção em ação autorizada. Para bytecode, sources e dependências, siga [o guia especializado](../codex/05-JAVA-E-ENGENHARIA-REVERSA.md). Para frontend, processos de desenvolvimento e browser exigem lifecycle próprio; uma ferramenta de shell não cria testes visuais automaticamente.

## 5.9 Cenários que o destino precisa testar

Teste comando simples, redirecionamento em pasta temporária, exit code não zero, espaço em caminho do executável, saída com muitos escapes, cancelamento, timeout e spawn falho. Teste que flags de checks/rede não ativam shell e que readOnly/consulta negam essa capacidade.

Processos de teste devem ter autolimite mesmo se o runner impedir `taskkill`. Na primeira validação local restrita, o sistema operacional bloqueou a limpeza dos descendentes; os três processos exatos do teste foram identificados e encerrados com a autorização correspondente, e os testes passaram a usar espera autolimitada. Isso é evidência do limite do ambiente, não uma razão para alegar limpeza garantida.

## 5.10 Evoluções possíveis

Para sessões interativas persistentes, implemente PTY, IDs de processos, controle de input, inventário, cancelamento, expiração e cleanup independente do contexto do modelo. Para isolamento forte no Windows, avalie um worker/VM/Job Object com os limites apropriados. Para serviços remotos, adicione idempotência e consulta de estado.

Essas são extensões planejadas. O modo atual oferece comandos delimitados por tempo/saída, sem uma sessão TTY persistente e sem sandbox do host.
