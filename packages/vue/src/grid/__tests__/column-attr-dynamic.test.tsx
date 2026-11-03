import { mountPcMode } from '@opentiny-internal/vue-test-utils'
import { describe, expect, test } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import Grid from '@opentiny/vue-grid'
import GridColumn from '@opentiny/vue-grid-column'

/**
 * 回归：tiny-grid-column 的 sortable 属性无法动态响应 (#3898)
 *
 * 根因：column.ts 在 setup 时用 Cell.createColumn($table, props) 一次性快照 props
 * 生成 ColumnConfig，此后除 formatConfig 外没有任何 props watch；且表格仅在列
 * 集合（列 id）变化时才重新收集列。因此通过响应式数据动态修改标签式列的
 * sortable 后，内部列配置仍是旧值，表头排序不生效。
 *
 * 修复：watch sortable，将新值同步到已创建的 columnConfig 上。
 * （配置式 columns 数组以新引用传入时本就经由 loadColumn 重建，不受此 bug 影响。）
 */
const tableData = [
  { id: 1, name: 'GFD科技YX公司', employees: 800 },
  { id: 2, name: 'WWW科技YX公司', employees: 300 }
]

const makeRoot = () =>
  defineComponent({
    data: () => ({ sortable: false }),
    render() {
      return (
        <Grid data={tableData}>
          <GridColumn field="employees" title="员工数" sortable={this.sortable} />
        </Grid>
      )
    }
  })

describe('grid-column sortable dynamic response (#3898)', () => {
  test('syncs dynamic sortable prop into internal column config', async () => {
    const wrapper = mountPcMode(makeRoot())
    await nextTick()
    await nextTick()

    const grid = wrapper.findComponent(Grid).vm as never as {
      getTableColumn: () => { fullColumn: Array<{ sortable: boolean }> }
    }
    const column = () => grid.getTableColumn().fullColumn.find((col) => col.sortable !== undefined)

    expect(column().sortable).toBe(false)

    await wrapper.setData({ sortable: true })
    await nextTick()
    expect(column().sortable).toBe(true)
  })

  test('sort() consumes the updated sortable value', async () => {
    const wrapper = mountPcMode(makeRoot())
    await nextTick()
    await nextTick()

    const table = (wrapper.findComponent(Grid).vm as never as { $refs: { tinyTable: Record<string, unknown> } }).$refs
      .tinyTable as never as {
      triggerSortEvent: (event: unknown, column: unknown, order: string) => void
      getTableColumn: () => { fullColumn: Array<{ property?: string; sortable: boolean; order?: string }> }
    }
    const column = () => table.getTableColumn().fullColumn.find((col) => col.property === 'employees')

    // sortable=false 时点击排序不改变 column.order
    await table.triggerSortEvent({}, column(), 'asc')
    expect(column().order).toBe(null)

    await wrapper.setData({ sortable: true })
    await nextTick()
    await table.triggerSortEvent({}, column(), 'asc')
    expect(column().order).toBe('asc')
  })
})
