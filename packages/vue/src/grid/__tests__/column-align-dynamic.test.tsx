import { mountPcMode } from '@opentiny-internal/vue-test-utils'
import { describe, expect, test } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import Grid from '@opentiny/vue-grid'
import GridColumn from '@opentiny/vue-grid-column'

/**
 * 回归：tiny-grid-column 的 align 属性动态修改不生效 (#4230)
 *
 * 根因：同 #3898/#3921 —— column.ts 在 setup 时一次性快照 props 生成 ColumnConfig，
 * 此后 align/headerAlign/footerAlign 变化不会同步到内部列配置，单元格对齐
 * （body 渲染读取 column.align 计算 col__{align} class）不随属性更新。
 *
 * 修复：watch 对齐相关 props，将新值同步到已创建的 columnConfig 上。
 * 注：TinyVue 源码中 align 并非废弃属性（没有任何废弃警告文案），issue 中
 * 的"废弃属性"提示来自外部（IDE/插件），align 是 grid-column 的正式 prop。
 */
const tableData = [
  { id: 1, name: 'GFD科技YX公司', employees: 800 },
  { id: 2, name: 'WWW科技YX公司', employees: 300 }
]

const makeRoot = () =>
  defineComponent({
    data: () => ({ align: undefined as string | undefined }),
    render() {
      return (
        <Grid data={tableData}>
          <GridColumn field="employees" title="员工数" align={this.align} headerAlign={this.align} />
        </Grid>
      )
    }
  })

describe('grid-column align dynamic response (#4230)', () => {
  test('syncs dynamic align props into internal column config', async () => {
    const wrapper = mountPcMode(makeRoot())
    await nextTick()
    await nextTick()

    const grid = wrapper.findComponent(Grid).vm as never as {
      getTableColumn: () => { fullColumn: Array<{ property?: string; align?: string; headerAlign?: string }> }
    }
    const column = () => grid.getTableColumn().fullColumn.find((col) => col.property === 'employees')

    expect(column().align).toBeUndefined()

    await wrapper.setData({ align: 'center' })
    await nextTick()
    expect(column().align).toBe('center')
    expect(column().headerAlign).toBe('center')
  })
})
