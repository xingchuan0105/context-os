import OpenAI, { type ClientOptions } from 'openai'
import type {
  ChatCompletionCreateParamsBase,
  ChatCompletionMessageParam,
  ChatCompletion,
} from 'openai/resources/chat/completions'

const FALLBACK_BASE_URL = 'http://localhost:4000'
const FALLBACK_API_KEY = 'local-dev'
const FALLBACK_MODEL = 'deepseek-chat'
const FALLBACK_EMBEDDING_MODEL = 'qwen3-embedding-4b'

function normalizeBaseURL(url: string) {
  const trimmed = url.replace(/\/+$/, '')
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
}

function resolveBaseURL() {
  return normalizeBaseURL(process.env.LITELLM_BASE_URL || FALLBACK_BASE_URL)
}

function resolveApiKey() {
  return process.env.LITELLM_API_KEY || FALLBACK_API_KEY
}

function resolveModel(model?: string) {
  return model || process.env.DEFAULT_MODEL || FALLBACK_MODEL
}

function resolveEmbeddingModel(model?: string) {
  return model || process.env.EMBEDDING_MODEL || FALLBACK_EMBEDDING_MODEL
}

function createClient(options?: Partial<ClientOptions>) {
  return new OpenAI({
    apiKey: options?.apiKey || resolveApiKey(),
    baseURL: normalizeBaseURL(options?.baseURL || resolveBaseURL()),
  })
}

type ChatParams = {
  model?: string
  messages: ChatCompletionMessageParam[]
  temperature?: number
  topP?: number
  maxTokens?: number
  responseFormat?: ChatCompletionCreateParamsBase['response_format']
}

export async function chat({
  model,
  messages,
  temperature,
  topP,
  maxTokens,
  responseFormat,
}: ChatParams): Promise<ChatCompletion> {
  const client = createClient()
  return client.chat.completions.create({
    model: resolveModel(model),
    messages,
    temperature,
    top_p: topP,
    max_tokens: maxTokens,
    response_format: responseFormat,
  })
}

export async function chatStream(params: ChatParams) {
  const client = createClient()
  return client.chat.completions.create({
    model: resolveModel(params.model),
    messages: params.messages,
    temperature: params.temperature,
    top_p: params.topP,
    max_tokens: params.maxTokens,
    response_format: params.responseFormat,
    stream: true,
  })
}

type StructuredParams = {
  system?: string
  user: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export async function structuredJson({
  system,
  user,
  model,
  temperature,
  maxTokens,
}: StructuredParams) {
  const client = createClient()
  return client.chat.completions.create({
    model: resolveModel(model),
    messages: [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      { role: 'user' as const, content: user },
    ],
    response_format: { type: 'json_object' },
    temperature,
    max_tokens: maxTokens,
  })
}

type EmbeddingParams = {
  model?: string
  input: string[] | string
}

export async function embed({ model, input }: EmbeddingParams) {
  const client = createClient()
  return client.embeddings.create({
    model: resolveEmbeddingModel(model),
    input,
  })
}

export { createClient }
