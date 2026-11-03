import { mountPcMode } from '@opentiny-internal/vue-test-utils'
import { describe, expect, test, vi } from 'vitest'
import { nextTick } from 'vue'
import Grid from '@opentiny/vue-grid'

/**
 * 回归：分页 pageSize 从大切小（如 500 -> 10）后表格顶部出现异常空白占位 (#1276)
 *
 * 根因：数据收缩触发 loadTableData -> clearScroll 时，只会重置外层滚动容器
 * （main-body-wrapper）的 scrollTop 与虚拟滚动的 startIndex；当外层 scrollTop
 * 本就为 0 时不会触发 scroll 事件，body 内层 sticky 容器的
 * wrapperScrollLeft/wrapperScrollTop 残留大分页时的旧偏移，顶部出现空白、
 * 视口错位。
 *
 * 修复：clearScroll 同步重置内层 sticky 容器偏移（wrapperScroll* 置 0 并调用
 * resetStickyWrapperScrollPos）。
 *
 * 注：jsdom 无真实布局与滚动，此处验证 clearScroll 的重置链路。
 */
const tableData = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `公司${i + 1}` }))
const columns = [{ field: 'name', title: '名称' }]

describe('clearScroll resets inner sticky wrapper offset (#1276)', () => {
  test('clearScroll resets scroll stores and sticky wrapper offset', async () => {
    const wrapper = mountPcMode(() => <Grid data={tableData} columns={columns} />)
    await nextTick()
    await nextTick()

    const grid = wrapper.findComponent(Grid).vm as never as { $refs: { tinyTable: unknown } }
    const table = grid.$refs.tinyTable as unknown as {
      clearScroll: () => Promise<void>
      afterMounted: boolean
      scrollYStore: { startIndex: number; visibleIndex: number }
      scrollXStore: { startIndex: number; visibleIndex: number }
      lastScrollTop: number
      $refs: { tableBody?: Record<string, unknown> }
    }

    table.afterMounted = true
    const bodyVm = table.$refs.tableBody
    expect(bodyVm).toBeTruthy()
    const resetSpy = vi.spyOn(bodyVm as { resetStickyWrapperScrollPos: () => void }, 'resetStickyWrapperScrollPos')

    // 模拟大分页时残留的滚动状态
    table.scrollYStore.startIndex = 300
    table.scrollYStore.visibleIndex = 300
    table.lastScrollTop = 12000

    table.clearScroll()
    // fastdom.mutate 经 requestAnimationFrame 调度，等待真实帧执行
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 20)))
    await nextTick()
    await nextTick()

    // 虚拟滚动切片与 lastScrollTop 归零
    expect(table.scrollYStore.startIndex).toBe(0)
    expect(table.scrollYStore.visibleIndex).toBe(0)
    expect(table.lastScrollTop).toBe(0)
    // 内层 sticky 容器偏移被同步重置
    expect(resetSpy).toHaveBeenCalled()
  })
})
