let _seq = 0;

// negativo, monotônico — nunca colide com ids reais do servidor (sempre positivos)
export function nextTempId(): number {
  return -(Date.now() * 1000 + (_seq++ % 1000));
}

export const isTempId = (id: number | undefined): boolean => typeof id === 'number' && id < 0;