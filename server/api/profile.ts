// 部署后路由：GET /api/profile?code=XXXXXXXX
import { handleProfile, storeUnavailable } from '../handlers'
import { blobStore } from '../store'

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  try {
    return await handleProfile(blobStore(), new URL(context.request.url))
  } catch (e) {
    console.error('profile failed', e)
    return storeUnavailable()
  }
}
