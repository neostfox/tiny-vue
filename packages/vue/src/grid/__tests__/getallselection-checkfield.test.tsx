import { mountPcMode } from '@opentiny-internal/vue-test-utils'
import { describe, expect, test } from 'vitest'
import { nextTick } from 'vue'
import Grid from '@opentiny/vue-grid'

/**
 * 回归：配置 select-config.checkField 后，getAllSelection() 永远返回空数组 (#3884)
 *
 * 根因：checkField 模式下勾选状态保存在行数据的自定义字段上（handleSelectRow 的
 * hasCheckField 分支通过 set(row, checkField, value) 写入），并不进入表格内部的
 * selection 数组；而 getAllSelection 之前只 return this.selection，没有像
 * getSelectRecords 那样处理 checkField 分支，导致该模式下获取不到任何勾选数据。
 *
 * 修复：getAllSelection 在 selectConfig.checkField 存在时改为按字段从全量数据中
 * 过滤（复用 getSelectRecords 的分支逻辑），否则维持返回 selection 的旧行为。
 */
const tableData = [
  { id: 1, name: 'GFD科技YX公司', checked: true },
  { id: 2, name: 'WWW科技YX公司', checked: false },
  { id: 3, name: 'CBB科技YX公司', checked: true }
]

const columns = [
  { type: 'selection', width: 60 },
  { field: 'name', title: '名称' }
]

describe('getAllSelection with select-config checkField (#3884)', () => {
  test('returns rows whose checkField is truthy', async () => {
    const wrapper = mountPcMode(() => (
      <Grid data={tableData} columns={columns} select-config={{ checkField: 'checked' }} />
    ))
    await nextTick()

    const grid = wrapper.findComponent(Grid).vm as never as { getAllSelection: () => Array<{ id: number }> }
    expect(grid.getAllSelection().map((row) => row.id)).toEqual([1, 3])
  })

  test('reflects checkField changes of row data', async () => {
    const data = [...tableData]
    const wrapper = mountPcMode(() => <Grid data={data} columns={columns} select-config={{ checkField: 'checked' }} />)
    await nextTick()

    const grid = wrapper.findComponent(Grid).vm as never as { getAllSelection: () => Array<{ id: number }> }
    data[1].checked = true
    await nextTick()
    expect(grid.getAllSelection().map((row) => row.id)).toEqual([1, 2, 3])

    data[0].checked = false
    await nextTick()
    expect(grid.getAllSelection().map((row) => row.id)).toEqual([2, 3])
  })

  test('still returns the internal selection array without checkField', async () => {
    const wrapper = mountPcMode(() => <Grid data={tableData} columns={columns} />)
    await nextTick()

    const grid = wrapper.findComponent(Grid).vm as never as {
      getAllSelection: () => Array<{ id: number }>
      setSelection: (rows: Array<{ id: number }>, value: boolean) => void
    }
    grid.setSelection([tableData[0]], true)
    await nextTick()
    // 未配置 checkField 时维持旧行为：返回内部 selection 集合
    expect(grid.getAllSelection().map((row) => row.id)).toEqual([1])
  })
})
