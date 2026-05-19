export class SubscriptionRegistry<ClientId extends string = string> {
  private readonly clients = new Map<ClientId, Set<string>>();
  private readonly symbols = new Map<string, Set<ClientId>>();

  addClient(clientId: ClientId) {
    if (!this.clients.has(clientId)) {
      this.clients.set(clientId, new Set());
    }
  }

  removeClient(clientId: ClientId) {
    const existingSymbols = this.clients.get(clientId);
    const removedSymbols: string[] = [];

    if (!existingSymbols) {
      return removedSymbols;
    }

    for (const symbol of existingSymbols) {
      const subscribers = this.symbols.get(symbol);
      subscribers?.delete(clientId);

      if (!subscribers || subscribers.size === 0) {
        this.symbols.delete(symbol);
        removedSymbols.push(symbol);
      }
    }

    this.clients.delete(clientId);
    return removedSymbols;
  }

  subscribe(clientId: ClientId, symbols: string[]) {
    this.addClient(clientId);

    const addedSymbols: string[] = [];
    const clientSymbols = this.clients.get(clientId);

    if (!clientSymbols) {
      return addedSymbols;
    }

    for (const symbol of symbols) {
      if (clientSymbols.has(symbol)) {
        continue;
      }

      const subscribers = this.symbols.get(symbol) ?? new Set<ClientId>();
      const hadSubscribers = subscribers.size > 0;

      subscribers.add(clientId);
      this.symbols.set(symbol, subscribers);
      clientSymbols.add(symbol);

      if (!hadSubscribers) {
        addedSymbols.push(symbol);
      }
    }

    return addedSymbols;
  }

  unsubscribe(clientId: ClientId, symbols: string[]) {
    const clientSymbols = this.clients.get(clientId);
    const removedSymbols: string[] = [];

    if (!clientSymbols) {
      return removedSymbols;
    }

    for (const symbol of symbols) {
      if (!clientSymbols.delete(symbol)) {
        continue;
      }

      const subscribers = this.symbols.get(symbol);
      subscribers?.delete(clientId);

      if (!subscribers || subscribers.size === 0) {
        this.symbols.delete(symbol);
        removedSymbols.push(symbol);
      }
    }

    return removedSymbols;
  }

  clientsForSymbol(symbol: string) {
    return this.symbols.get(symbol) ?? new Set<ClientId>();
  }

  symbolsForClient(clientId: ClientId) {
    return this.clients.get(clientId) ?? new Set<string>();
  }

  activeSymbols() {
    return Array.from(this.symbols.keys());
  }
}
