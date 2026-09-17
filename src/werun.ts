/**
 * 王铁 OS — 微信运动同步（服务端）。
 * 微信侧：微信运动步数只能由「微信小程序」通过 wx.getWeRunData 获取（返回
 * encryptedData），普通网页无法直连。因此：
 *   1) 小程序拿到 wx.login 的 code + getWeRunData 的 encryptedData/iv；
 *   2) POST 给本接口 → code2session 换 session_key → AES-128-CBC 解密出
 *      stepInfoList（每天步数）→ 落盘到 $DSH_HOME/wangtie-os/werun.json；
 *   3) 王铁 OS「健康减重」读取 /api/health/werun/latest 展示今日步数。
 * 需要：小程序 AppID/AppSecret（环境变量 WEIXIN_APPID / WEIXIN_SECRET），
 * 小程序后台把本服务 HTTPS 域名加入 request 合法域名。
 */

import { createDecipheriv, createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { get } from 'node:https'
import { join } from 'node:path'
import { configDir } from './config.ts'

function werunFile(): string {
  return join(configDir(), 'werun.json')
}

export function loadWeRunMap(): Record<string, number> {
  try {
    return JSON.parse(readFileSync(werunFile(), 'utf8')) as Record<string, number>
  } catch {
    return {}
  }
}

export function saveWeRunEntry(date: string, steps: number): void {
  const map = loadWeRunMap()
  map[date] = steps
  writeFileSync(werunFile(), JSON.stringify(map, null, 2), 'utf8')
}

/** 小程序 code 换 session_key/openid（GET api.weixin.qq.com）。 */
export function code2session(code: string): Promise<{ openid?: string; session_key?: string; errcode?: number; errmsg?: string }> {
  const appid = process.env.WEIXIN_APPID
  const secret = process.env.WEIXIN_SECRET
  if (!appid || !secret) {
    return Promise.reject(new Error('未配置 WEIXIN_APPID / WEIXIN_SECRET（小程序 AppID / AppSecret）'))
  }
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      let raw = ''
      res.on('data', (c) => { raw += c })
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw))
        } catch (e) {
          reject(new Error('code2session 返回解析失败'))
        }
      })
    }).on('error', reject)
  })
}

/** 微信加密数据 AES-128-CBC 解密（session_key / iv 均为 base64）。 */
export function decryptWeixinData(encryptedData: string, sessionKey: string, iv: string): unknown {
  const decipher = createDecipheriv('aes-128-cbc', Buffer.from(sessionKey, 'base64'), Buffer.from(iv, 'base64'))
  decipher.setAutoPadding(true)
  const decoded = Buffer.concat([decipher.update(Buffer.from(encryptedData, 'base64')), decipher.final()])
  return JSON.parse(decoded.toString('utf8'))
}

/** 微信运动数据里「今天」的步数：按 UTC+8 的本地日期匹配 stepInfoList。 */
export function todayStepsFromWeRun(data: { stepInfoList?: Array<{ timestamp: number; step: number }> }): { date: string; steps: number } {
  const list = data.stepInfoList ?? []
  const latest = list.length ? list[list.length - 1] : null
  if (!latest) return { date: '', steps: 0 }
  // 微信返回 timestamp 为 UTC 秒；中国时区 +8h 后取日期
  const d = new Date((latest.timestamp + 8 * 3600) * 1000)
  const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  return { date, steps: latest.step }
}

// 保留：校验用的 appid 水印（可选）
export function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex')
}
