# Contribuir

Node.js 24+. Execute `npm.cmd test`, `npm.cmd run check` e `npm.cmd run evaluate` (ou `npm` fora do Windows). Mudanças no executor também exigem `npm.cmd run test:docker` com Docker real. Mudanças no adaptador devem atualizar testes de contrato e, quando houver credencial autorizada, o smoke real opt-in.

Preserve invariantes de autorização, revisão, orçamento e correlação. Não adicione dependência sem uma necessidade concreta, licença revisada e lock atualizado. Faça configuração e documentação refletirem o comportamento efetivo. Evidencie limites de cada validação; não apresente testes roteirizados como resultados de modelos.

O estudo original permanece uma fonte histórica. Documente interpretações e alterações de produto em `docs/`, sem reescrever suas conclusões como se a implementação já tivesse sido auditada pelo autor.

Não há licença de redistribuição concedida neste momento (`UNLICENSED`); a definição depende do titular do projeto. Não envie segredos, journals de produção ou dados de terceiros em commits/issues.
