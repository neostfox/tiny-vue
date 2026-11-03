import { mountPcMode } from '@opentiny-internal/vue-test-utils'
import { describe, expect, test } from 'vitest'
import { nextTick } from 'vue'
import Grid from '@opentiny/vue-grid'

/**
 * 回归：配置 drop-config 行拖拽排序后，getRecordset().updateRecords 不包含拖拽影响的行 (#3924)
 *
 * 根因：行拖拽（rowDrop 的 createHandlerOnEnd）只对原始数据做数组 splice 重排 +
 * refreshData 重建渲染与行备份，行对象字段没有任何变化；而 updateRecords 的判定
 * 是行字段与 originRow 备份的 diff，顺序变化不会进入任何记录。
 *
 * 修复：拖拽完成后调用 markDragSortRecords 记录被拖拽的行；_getUpdateRecords 将
 * 记录的行并入 updateRecords（排除已删除、临时新增、已不在当前数据中的行）；
 * clearAll 一并清空记录。
 *
 * 注：jsdom 下无法真实模拟 sortablejs 的拖拽事件，此处直接调用拖拽完成后的
 * 记录入口 markDragSortRecords，验证 getRecordset 的行为链路。
 */
const tableData = [
  { id: 1, name: 'GFD科技YX公司' },
  { id: 2, name: 'WWW科技YX公司' },
  { id: 3, name: 'CBB科技YX公司' }
]

const columns = [{ field: 'name', title: '名称' }]

interface TableStub {
  markDragSortRecords: (rows: Array<{ id: number }>) => void
  getRecordset: () => { updateRecords: Array<{ id: number }> }
  clearAll: () => void
  updateRawData: (rows: Array<{ id: number; name: string }>) => void
}

const mountGrid = async () => {
  const wrapper = mountPcMode(() => <Grid data={tableData} columns={columns} />)
  await nextTick()
  await nextTick()
  const grid = wrapper.findComponent(Grid).vm as never as { $refs: { tinyTable: unknown } }
  return { wrapper, table: grid.$refs.tinyTable as never as TableStub }
}

describe('drag sort rows should be included in updateRecords (#3924)', () => {
  test('marked dragged row is contained in getRecordset().updateRecords', async () => {
    const { table } = await mountGrid()

    // 拖拽前无更新记录
    expect(table.getRecordset().updateRecords.map((row) => row.id)).toEqual([])

    // 模拟拖拽完成：行被重排后记录被拖拽的行
    table.markDragSortRecords([tableData[1]])
    expect(table.getRecordset().updateRecords.map((row) => row.id)).toEqual([2])
  })

  test('field-modified rows are not duplicated by drag marks', async () => {
    const { table } = await mountGrid()

    tableData[0].name = 'GFD科技改'
    table.markDragSortRecords([tableData[0]])

    const ids = table.getRecordset().updateRecords.map((row) => row.id)
    expect(ids).toEqual([1])
  })

  test('stale drag marks are ignored after data is reloaded', async () => {
    const { table } = await mountGrid()

    table.markDragSortRecords([tableData[1]])
    // 重新加载全量新数据（行对象为全新引用，走 updateRawData 而非 clearAll）
    table.updateRawData([{ id: 9, name: '新数据公司' }])
    await nextTick()
    await nextTick()

    expect(table.getRecordset().updateRecords.map((row) => row.id)).toEqual([])
  })

  test('clearAll resets drag sort records', async () => {
    const { table } = await mountGrid()

    table.markDragSortRecords([tableData[2]])
    expect(table.getRecordset().updateRecords.map((row) => row.id)).toEqual([3])

    table.clearAll()
    expect(table.getRecordset().updateRecords.map((row) => row.id)).toEqual([])
  })
})
