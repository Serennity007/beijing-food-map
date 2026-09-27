/**
 * 隐私说明 / 用户条款（对应 Web /privacy /terms）：静态要点页，演示版如实写明数据处置与保留策略。
 * tabBar 页 switchTab 不能带参，本页为普通页面，经 ?kind=privacy|terms 区分。
 */
import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import './index.scss'

type Kind = 'privacy' | 'terms'

const COLLECTION_ITEMS = [
  '手机号仅用于登录。演示版不接入短信服务，账号是本机合成的测试账号。',
  '演示版不接受真实照片：图片一律是服务端生成的合成图（is_test_data 恒为 true），本身不含 EXIF。生产版必须真的剥离 EXIF（含 GPS）并按当前权限上下文保存。',
]
const VISIBLE_ITEMS = [
  '想吃／吃过／私藏与自定义清单默认私密，公开需要显式发布并通过内容审核。',
  '公开清单是一份不可变快照；撤销分享后旧链接立即失效，且不会被恢复。',
  '已被他人下载或截图的内容无法收回，因此发布前请预览。',
]
const DELETE_ITEMS = [
  '撤回反馈：立即停止公开并退出计票，历史版本不会自动复活。',
  '注销：立即撤销会话、撤销本人公开分享、隐藏资料与投稿，票数即时重算。随后自动清除账号投稿、图片、清单和分享快照，清空显示名与电话；保留去标识账号 ID、举报状态与审计记录供复核。服务重启后继续未完成任务。',
  '用于门店定位的独立公共事实（地址、坐标）可保留，但不会以你的名义继续推荐。',
]
const RULE_ITEMS = [
  '只记录本人真实吃过的店；投稿需要实吃日期、至少一道菜、理由与原创图片。',
  '与门店存在利益关系（店方/员工、受邀试吃、获赠或推广等）必须披露；披露内容公开显示但不计入社区独立票。',
  '真实负面反馈允许存在并正常计票，不因差评自动处罚门店。',
  '禁止编造实吃、票数与图片，禁止搬运第三方评论和照片。',
]
const RECO_ITEMS = [
  '社区资格：近 180 个自然日内（含两端）有效独立推荐 ≥ 3 且 4×推荐 ≥ 3×总票数。',
  '编辑背书：编辑实吃 + 另一名合格核验人，超过 180 天自动失效。',
  '地点未核验、疑似闭店、风险复核中的门店不进入默认图层；「待验证」是单独图层并明确标注。',
]

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <View className="field">
      <Text className="label">{title}</Text>
      {items.map((it) => (
        <View className="legal-item" key={it.slice(0, 12)}>
          <Text className="legal-dot">·</Text>
          <Text className="legal-text">{it}</Text>
        </View>
      ))}
    </View>
  )
}

export default function Legal() {
  const { params } = useRouter()
  const [kind, setKind] = useState<Kind>('privacy')

  useEffect(() => {
    setKind(params.kind === 'terms' ? 'terms' : 'privacy')
  }, [params.kind])

  const privacy = kind === 'privacy'

  return (
    <View className="page">
      <View className="head">
        <Text className="h1">{privacy ? '隐私说明（演示版）' : '用户条款（演示版）'}</Text>
        <Text className="sub">演示版如实写明数据处置与保留策略，不承诺无法做到的事。</Text>
      </View>

      <View className="panel">
        {privacy ? (
          <>
            <Block title="我们收集什么" items={COLLECTION_ITEMS} />
            <Block title="谁能看到什么" items={VISIBLE_ITEMS} />
            <Block title="删除与注销" items={DELETE_ITEMS} />
            <Text className="hint">日志与备份保留周期在上线前确定，本演示不声称「永久删除」或「永久保存」。</Text>
          </>
        ) : (
          <>
            <Block title="内容规则" items={RULE_ITEMS} />
            <Block title="推荐是怎么来的" items={RECO_ITEMS} />
            <View className="field">
              <Text className="label">演示版免责声明</Text>
              <Text className="legal-text">本应用为工程演示：门店、地址、图片、实吃记录与票数均为合成测试数据，不代表任何真实餐馆，也不构成消费建议。</Text>
            </View>
          </>
        )}
      </View>

      <View className="btn-row">
        <Button className="btn-plain" onClick={() => setKind(privacy ? 'terms' : 'privacy')}>
          切换到{privacy ? '用户条款' : '隐私说明'}
        </Button>
        <Button className="btn-plain" onClick={() => Taro.switchTab({ url: '/pages/me/index' })}>
          返回我的
        </Button>
      </View>

      <View className="footer-note">
        <Text className="hint">完整交互版见网页端「隐私说明 / 用户条款」页。</Text>
      </View>
    </View>
  )
}
