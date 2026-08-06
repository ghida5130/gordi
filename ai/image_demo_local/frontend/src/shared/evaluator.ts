const STORAGE_KEY = 'gordi-evaluator'

export const readEvaluatorId = (): string =>
  localStorage.getItem(STORAGE_KEY) || ''

export const writeEvaluatorId = (evaluatorId: string): void => {
  localStorage.setItem(STORAGE_KEY, evaluatorId)
}
