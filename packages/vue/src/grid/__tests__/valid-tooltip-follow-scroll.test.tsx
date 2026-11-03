import { mountPcMode } from '@opentiny-internal/vue-test-utils'
import { describe, expect, test, vi } from 'vitest'
import { nextTick } from 'vue'
import Grid from '@opentiny/vue-grid'

/**
 * 回归：Grid 设置 edit-rules 后，行内编辑必填校验提示浮层不随页面/表格滚动 (#3960)
 *
 * 根因：校验提示浮层（validTip，popper）只在弹出时做一次定位
 * （showValidTooltip → activateTooltipValid → updatePopper），表格 body 滚动与
 * 全局页面滚动均无重定位逻辑，滚动后浮层停留在原位置。
 *
 * 修复：
 * - validator methods 新增 updateValidTooltip：validStore.visible 时调用
 *   validTip.updatePopper() 重定位
 * - body 的 handleScroll 与全局 window scroll（GlobalEvent 新增 scroll 通道）
 *   都调用该方法，浮层跟随单元格滚动
 *
 * 注：jsdom 无法触发真实滚动与 popper 定位，此处验证方法级行为链路。
 */
const tableData = [{ id: 1, name: '' }]
const columns = [{ field: 'name', title: '名称' }]
const editRules = { name: [{ required: true, message: '名称必填' }] }

describe('valid error tooltip follows scroll (#3960)', () => {
  test('updateValidTooltip repositions visible tooltip on scroll', async () => {
    // 配置 edit-rules 使校验提示浮层（validTip）真实渲染
    const wrapper = mountPcMode(() => <Grid data={tableData} columns={columns} editRules={editRules} />)
    await nextTick()
    await nextTick()

    const grid = wrapper.findComponent(Grid).vm as never as { $refs: { tinyTable: unknown } }
    const table = grid.$refs.tinyTable as unknown as {
      updateValidTooltip: () => void
      handleGlobalScrollEvent: () => void
      validStore: { visible: boolean }
      $refs: { validTip?: { updatePopper: () => void } }
    }

    const validTip = table.$refs.validTip
    expect(validTip).toBeTruthy()
    const updatePopper = vi.spyOn(validTip as { updatePopper: () => void }, 'updatePopper')

    // 浮层未显示时不重定位
    table.validStore.visible = false
    table.updateValidTooltip()
    expect(updatePopper).not.toHaveBeenCalled()

    // 浮层显示时：表格 body 滚动触发重定位
    table.validStore.visible = true
    table.updateValidTooltip()
    expect(updatePopper).toHaveBeenCalledTimes(1)

    // 全局页面滚动触发重定位
    table.handleGlobalScrollEvent()
    expect(updatePopper).toHaveBeenCalledTimes(2)
  })
})
