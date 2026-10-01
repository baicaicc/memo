// 部署后路由：POST /api/sync
import { badRequest, handleSync, storeUnavailable } from '../handlers'
import { blobStore } from '../store'

export async function onRequestPost(context: { request: Request }): Promise<Response> {
  let body: unknown
  try {
    body = await context.request.json()
  } catch {
    return badRequest()
  }
  try {
    return await handleSync(blobStore(), body)
  } catch (e) {
    console.error('sync failed', e)
    return storeUnavailable()
  }
}
