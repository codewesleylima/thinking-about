# Configuração e operação

## Instalação

Use Node.js 24+. Na raiz, `npm.cmd ci --ignore-scripts --no-audit --no-fund` no Windows ou `npm ci --ignore-scripts --no-audit --no-fund` no Linux/macOS. Não há pacotes externos de runtime nem etapas de geração de código. `node bin/wzzy.js --help` lista a CLI. No PowerShell, `npm.cmd` evita depender da política de execução de `npm.ps1`.

Execute `node bin/wzzy.js init --workspace <diretorio-existente>` para outro projeto. Os arquivos existentes são preservados. `--config <arquivo>` seleciona configuração explícita; por padrão é usado `wzzy.config.json` no workspace, com defaults para campos omitidos. Campos desconhecidos são rejeitados. O operador deve revisar configuração de um repositório não confiável antes de habilitar execução.

Precedência: defaults → arquivo JSON → `WZZY_PROVIDER`, `WZZY_MODEL`, `WZZY_BASE_URL`. Flags da CLI concedem edição/execução. `.env.example` é referência, não carregado automaticamente.

## Inferência local

Instale e inicie Ollama conforme sua [documentação oficial](https://docs.ollama.com/quickstart). O adaptador usa [`POST /api/chat`](https://docs.ollama.com/api/chat), `stream:false`, ferramentas e `think:false`. Escolha um modelo instalado que aceite essas capacidades e tenha contexto suficiente. O projeto não presume capacidade de GPU, memória nem licença dos pesos.

```powershell
$env:WZZY_PROVIDER = "ollama"
$env:WZZY_MODEL = "<modelo-instalado-com-tool-use>"
$env:WZZY_BASE_URL = "http://127.0.0.1:11434"
node bin/wzzy.js doctor
node bin/wzzy.js run "Localize a função de autenticação e explique suas dependências"
```

URLs Ollama são restritas ao loopback. Servidor remoto exige desenho adicional de autenticação e rede. Caso o servidor rejeite `think:false`, selecione um modelo/versão compatível; o erro não é escondido nem repetido indefinidamente.

## OpenAI Responses

O adaptador usa [function calling oficial](https://developers.openai.com/api/docs/guides/function-calling), schemas estritos, `store:false`, `parallel_tool_calls:false` e preservação dos itens necessários entre chamadas. O endpoint é fixado a `https://api.openai.com/v1`; credencial não segue redirects. A aplicação não fornece login com assinatura de ChatGPT nem usa credenciais do Codex.

Defina `WZZY_PROVIDER=openai`, `WZZY_MODEL` e `OPENAI_API_KEY`. Ao trocar o provedor padrão por ambiente, a URL é ajustada para OpenAI se ainda estiver no default Ollama. Se `WZZY_BASE_URL` estiver definido para Ollama, remova-o antes da troca:

```powershell
Remove-Item Env:WZZY_BASE_URL -ErrorAction SilentlyContinue
$env:WZZY_PROVIDER = "openai"
$env:WZZY_MODEL = "<modelo-acessivel-na-conta>"
$env:OPENAI_API_KEY = "<chave>"
```

Crie uma cópia de configuração e preencha `pricing` com os valores da [página oficial de preços](https://developers.openai.com/api/docs/pricing). Unidade dos campos `input` e `output`: **microdólares por milhão de tokens**. Por exemplo, um preço hipotético de US$2/M é representado por `2000000`. Esse exemplo de conversão não indica o preço de nenhum modelo.

```json
{
  "pricing": {
    "input": 2000000,
    "output": 10000000,
    "source": "https://developers.openai.com/api/docs/pricing",
    "asOf": "2026-10-20"
  }
}
```

Use valores conservadores para todas as faixas/modos que o pedido possa atingir e atualize data e fonte. Cache é contabilizado como entrada cheia: não há desconto presumido. Reserva = estimativa de entrada de um token por byte + 4096 de margem, acrescida do teto de saída. Timeout/uso ausente mantém a reserva. Não é garantia contratual de teto de cobrança; estabeleça também limites de conta no provedor. Não configure preço zero para contornar admissão.

## Permissões e execução

```powershell
node bin/wzzy.js run "Corrija a função em src/" --allow-write
node bin/wzzy.js run "Corrija e verifique a função" --allow-write --allow-exec
```

`writeRoots` usa prefixos de diretório ou caminhos exatos, sem globs. O padrão autoriza somente `src`, `tests` e `docs` quando a flag de edição está presente. Arquivos de controle, estado, segredos reconhecidos e avaliadores no diretório `evaluations` continuam protegidos contra escrita. Não existe opção `--yes` que desligue toda a política.

Docker com containers Linux é obrigatório para `run_check`. Prepare previamente a imagem e dependências autorizadas:

```powershell
docker pull node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
npm.cmd run test:docker
```

A referência padrão está fixada por digest obtido da imagem oficial e testado nesta entrega, registrado em `wzzy.config.json`. Para atualizar a imagem ou mudar linguagem, valide a imagem preparada e substitua `docker.image` por uma referência com digest. O executor usa `--pull=never`, não instala dependências nem abre rede. Para Java ou Python, escolha imagem com ferramentas e dependências necessárias e adapte os `argv` cadastrados. Não use instalações de pacote no comando de verificação: snapshots são somente leitura e rede é negada.

`commands` mapeia nomes para arrays `argv`; o modelo escolhe apenas o nome, sem fornecer novos argumentos. Todos os comandos executam em snapshots. Defina `verification:true` apenas para comandos que realmente verificam o projeto. Projetos que geram arquivos devem gravar em `/tmp` e apontar seus caches para `/tmp`. O executor não publica alterações geradas pelo processo.

## Limites padrão

| Recurso | Valor |
|---|---|
| Chamadas de modelo / ferramenta | 24 / 80 por sessão |
| Prazo absoluto / requisição / comando | 15 min / 120 s / 60 s |
| Saída do modelo | 4096 tokens |
| Contexto enviado | 180000 bytes antes da serialização específica do provedor |
| Arquivo lido / resultado de ferramenta | 1 MiB / 32 KiB |
| Scan | 2000 entradas visitadas; inclui diretórios e entradas ignoradas |
| Snapshot | 8 MiB por arquivo, 32 MiB total |
| Orçamento | 1000000 microUSD = US$1 por sessão |
| Repetição | terceira chamada idêntica na janela de 12 propostas interrompe |
| Container | 512 MiB RAM, 1 CPU, 64 PIDs, tmpfs de 64 MiB |

Use `read_lines` para arquivos grandes. Não há compactação silenciosa. O tempo de sessão inclui espera entre retomadas. Operações locais de arquivo são cooperativas; limpeza de Docker pode acrescentar até duas tentativas de 10 s ao prazo do comando.

## Sessões e diagnóstico

Sessões ficam em `<workspace>/.wzzy/sessions/<uuid>.jsonl`, ignoradas pelo Git. `sessions` lista e `inspect <uuid>` valida integridade e mostra eventos. `resume <uuid> "resposta"` exige a mesma configuração e flags. O journal mantém código, resultados e histórico selecionados; trate-o como dado sensível. Redação por nomes de variáveis/formatos conhecidos não substitui revisão de dados.

Após crash, um lock antigo é preservado. Leia `.wzzy/workspace.lock`, confira o PID e remova somente esse lock se o processo não estiver mais ativo. Se um container ficou pendente, inspecione os nomes `wzzy-*` e remova o container específico após conferir a sessão. Não há limpeza indiscriminada de recursos Docker. Cauda incompleta ou journal adulterado é rejeitado; preserve uma cópia e comece nova sessão após revisar os efeitos.

No chat, use `/new` e `/exit`. `Ctrl+C` cancela a sessão ativa. Em automação, `--json` emite somente objetos JSONL em stdout. Erros de inicialização vão para stderr. Códigos: 0 término operacional; 2 erro; 3 limite; 4 pergunta; 5 falha/efeito incerto; 130 cancelamento. Interprete também o campo `status`.

`doctor` faz consultas de disponibilidade, sem inferência. Um ambiente que bloqueia o pipe Docker pode apresentar indisponibilidade no sandbox mesmo com daemon ativo fora dele. Execute os comandos de validação em um terminal com acesso autorizado ao daemon.
