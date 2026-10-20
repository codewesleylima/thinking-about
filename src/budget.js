import { invariant } from './util.js';
const charge = (tokens, rate) => {
  const result = (BigInt(tokens) * BigInt(rate) + 999999n) / 1000000n;
  invariant(result <= BigInt(Number.MAX_SAFE_INTEGER), 'Custo excede precisão suportada');
  return Number(result);
};
export class Budget {
  constructor(config, state) { this.config = config; this.state = state; }
  reserve(bytes) {
    const { config: c, state: s } = this;
    invariant(s.modelCalls < c.limits.maxModelCalls, 'Limite de chamadas de modelo atingido');
    invariant(bytes <= c.limits.maxContextBytes, 'Contexto excede limite; inicie sessão com objetivo menor');
    invariant(c.provider !== 'openai' || c.pricing, 'API paga exige pricing com fonte/data configurados');
    // Um token por byte + margem: estimativa conservadora, não tokenização certificada.
    const amount = c.provider === 'openai'
      ? charge(bytes + 4096, c.pricing.input) + charge(c.limits.maxOutputTokens, c.pricing.output) : 0;
    invariant(s.spent + s.held + amount <= c.limits.maxCostMicrousd, 'Reserva excede orçamento');
    s.held += amount; s.modelCalls++;
    return amount;
  }
  settle(reserved, usage) {
    const s = this.state, c = this.config;
    if (c.provider !== 'openai') { s.held -= reserved; return; }
    if (!usage || !Number.isSafeInteger(usage.input) || usage.input < 0 || !Number.isSafeInteger(usage.output) || usage.output < 0) return;
    const actual = charge(usage.input, c.pricing.input) + charge(usage.output, c.pricing.output);
    s.held -= reserved; s.spent += actual;
    invariant(actual <= reserved && s.spent + s.held <= c.limits.maxCostMicrousd, 'Uso excedeu reserva: novas chamadas interrompidas');
  }
}
