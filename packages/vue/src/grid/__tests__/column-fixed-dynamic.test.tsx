import { mountPcMode } from '@opentiny-internal/vue-test-utils'
import { describe, expect, test, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import Grid from '@opentiny/vue-grid'
import GridColumn from '@opentiny/vue-grid-column'

/**
 * 回归：tiny-grid-column 的 fixed 属性无法动态设置 (#3921)
 *
 * 根因：column.ts 在 setup 时用 Cell.createColumn($table, props) 一次性快照 props，
 * 此后修改标签式列的 fixed 不会同步到内部列配置对象，也不会触发 refreshColumn
 * 重新按 fixed 分桶布局，固定列设置不生效。
 *
 * 修复：watch fixed，将新值同步到 columnConfig（经 setter 重建 FixedDetails），
 * 并调用 $table.refreshColumn() 重新计算固定列布局。
 */
const tableData = [
  { id: 1, name: 'GFD科技YX公司', employees: 800 },
  { id: 2, name: 'WWW科技YX公司', employees: 300 }
]

const makeRoot = () =>
  defineComponent({
    data: () => ({ fixed: undefined as string | undefined }),
    render() {
      return (
        <Grid data={tableData}>
          <GridColumn field="name" title="名称" />
          <GridColumn field="employees" title="员工数" fixed={this.fixed} />
        </Grid>
      )
    }
  })

describe('grid-column fixed dynamic response (#3921)', () => {
  test('syncs dynamic fixed prop into internal column config and refreshes layout', async () => {
    const wrapper = mountPcMode(makeRoot())
    await nextTick()
    await nextTick()

    const grid = wrapper.findComponent(Grid).vm as never as { $refs: { tinyTable: Record<string, unknown> } }
    const table = grid.$refs.tinyTable as unknown as {
      getTableColumn: () => {
        fullColumn: Array<{ property?: string; fixed?: string; fixedDetails?: { isRight: boolean } }>
      }
      refreshColumn: () => void
    }
    const column = () => table.getTableColumn().fullColumn.find((col) => col.property === 'employees')

    expect(column().fixed).toBeUndefined()

    const refreshSpy = vi.spyOn(table, 'refreshColumn')
    await wrapper.setData({ fixed: 'right' })
    await nextTick()

    expect(column().fixed).toBe('right')
    // FixedDetails 需随新值重建
    expect(column().fixedDetails?.isRight).toBe(true)
    // fixed 变化需要重新按 fixed 分桶布局
    expect(refreshSpy).toHaveBeenCalled()
  })
})
