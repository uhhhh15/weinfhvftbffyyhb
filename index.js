let waitingTable = []; // 初始化为空数组，表示等待处理的表格数据
let tablePopup = null; 


import {
    eventSource,
    event_types,
    saveSettingsDebounced,
} from '../../../../script.js';
import { extension_settings, getContext, renderExtensionTemplateAsync } from '../../../extensions.js';
import { POPUP_TYPE, Popup } from '../../../popup.js';

// 默认插件设置
const defaultSettings = {
    injection_mode: 'deep_system',
    deep: -3,
    message_template: `# dataTable表格
dataTable是一个用于储存故事数据的csv格式表格，可以作为你推演下文的重要参考。推演的下文可以在表格基础上做出发展，并影响表格。
## A. 表格说明及数据
你可以在这里查看所有的表格数据，以及表格的说明和修改表格的触发条件。表格中表名格式为[tableIndex:表名]例如[2:角色特征表格];列名的格式为[colIndex:列名]例如[2:示例列];行名的格式为[rowIndex]。
{{tableData}}
# 增删改dataTable操作方法
当你生成正文后，根据前面所列的增删改触发条件，如果判断数据dataTable中的内容需要增删改，则使用这里的操作方法进行。
注意：
1. 当用户要求修改表格时，用户要求的优先级最高。
3. 使用insertRow函数插入行时，应上帝视角填写所有列，禁止写成未知或者空值。
4. 单元格中，不要出现逗号，语义分割应使用/代替。
5. 当表格中出现undefined、暂无时，应立即更新该单元格。

## 1. 在某个表格中插入新行，使用insertRow函数：
insertRow(tableIndex:number, data:{[colIndex:number]:string|number})
例如：insertRow(0, {0: '2021-10-01', 1: '12:00', 2: '教室', 3: '悠悠'})
注意：请检查data:{[colIndex:number]:string|number}参数是否包含所有的colIndex，且禁止填写为未知。
## 2. 在某个表格中删除行，使用deleteRow函数：
deleteRow(tableIndex:number, rowIndex:number)
例如：deleteRow(0, 0)
## 3. 在某个表格中更新行，使用updateRow函数：
updateRow(tableIndex:number, rowIndex:number, data:{[colIndex:number]:string|number})
例如：updateRow(0, 0, {3: '惠惠'})

你需要在<tableEdit>标签中输出对每个表格的检视过程，使用js注释写简短的判断依据。如果需要增删改，则使用js的函数写法调用函数。
输出示例：
<tableEdit>
<!--
// 时空表格中的角色发生了改变，需要更新
updateRow(0, 0, {3: '惠惠/悠悠'})
// 角色特征表格由于出现了新人物，需要插入
insertRow(1, {1:'悠悠', 1:'身高170/体重60kg/身材娇小/黑色长发', 2:'开朗活泼', 3:'学生', 4:'打羽毛球, 5:'鬼灭之刃', 6:'宿舍', 7:'是运动部部长'})
// 角色与<user>社交表格由于出现了新人物，需要插入
insertRow(2, {1:'悠悠', 1:'喜欢', 2:'依赖/喜欢', 3:'高'})
// 任务、命令或者约定表格由于没有新任务、命令或者约定，所以不需要操作
// 重要事件历史表格由于悠悠向惠惠表白，所以需要插入
insertRow(4, {0: '惠惠/悠悠', 1: '惠惠向悠悠表白', 2: '2021-10-01', 3: '教室',4:'感动'})
// 重要物品表格由于没有新物品，所以不需要操作
-->
</tableEdit>
`,
    tableStructure: [
        {
            tableName: "时空表格", tableIndex: 0, columns: ['日期', '时间', '地点（当前描写）', '此地角色'], columnsIndex: [0, 1, 2, 3], enable: true, Required: true, note: "记录时空信息的表格，应保持在一行",
            initNode: '本轮需要记录当前时间、地点、人物信息，使用insertRow函数', updateNode: "当描写的场景，时间，人物变更时", deleteNode: "此表大于一行时应删除多余行"
        },
        {
            tableName: '角色特征表格', tableIndex: 1, columns: ['角色名', '身体特征', '性格', '职业', '爱好', '喜欢的事物（作品、虚拟人物、物品等）', '住所', '其他重要信息'], enable: true, Required: true, columnsIndex: [0, 1, 2, 3, 4, 5, 6, 7], note: '角色天生或不易改变的特征csv表格，思考本轮有否有其中的角色，他应作出什么反应',
            initNode: '本轮必须从上文寻找已知的所有角色使用insertRow插入，角色名不能为空', insertNode: '当本轮出现表中没有的新角色时，应插入', updateNode: "当角色的身体出现持久性变化时，例如伤痕/当角色有新的爱好，职业，喜欢的事物时/当角色更换住所时/当角色提到重要信息时", deleteNode: ""
        },
        {
            tableName: '角色与<user>社交表格', tableIndex: 2, columns: ['角色名', '对<user>关系', '对<user>态度', '对<user>好感'], columnsIndex: [0, 1, 2, 3], enable: true, Required: true, note: '思考如果有角色和<user>互动，应什么态度',
            initNode: '本轮必须从上文寻找已知的所有角色使用insertRow插入，角色名不能为空', insertNode: '当本轮出现表中没有的新角色时，应插入', updateNode: "当角色和<user>的交互不再符合原有的记录时/当角色和<user>的关系改变时", deleteNode: ""
        },
        {
            tableName: '任务、命令或者约定表格', tableIndex: 3, columns: ['角色', '任务', '地点', '持续时间'], columnsIndex: [0, 1, 2, 3], enable: true, Required: false, note: '思考本轮是否应该执行任务/赴约',
            insertNode: '当特定时间约定一起去做某事时/某角色收到做某事的命令或任务时', updateNode: "", deleteNode: "当大家赴约时/任务或命令完成时/任务，命令或约定被取消时"
        },
        {
            tableName: '重要事件历史表格', tableIndex: 4, columns: ['角色', '事件简述', '日期', '地点', '情绪'], columnsIndex: [0, 1, 2, 3, 4], enable: true, Required: false, note: '',
            insertNode: '当某个角色经历让自己印象深刻的事件时，比如表白、分手等', updateNode: "", deleteNode: ""
        },
        {
            tableName: '重要物品表格', tableIndex: 5, columns: ['拥有人', '物品描述', '物品名', '重要原因'], columnsIndex: [0, 1, 2, 3], enable: true, Required: false, note: '对某人很贵重或有特殊纪念意义的物品',
            insertNode: '当某人获得了贵重或有特殊意义的物品时/当某个已有物品有了特殊意义时', updateNode: "", deleteNode: ""
        },
    ]
};


function findTableStructureByIndex(index) {
    const table = extension_settings.muyoo_dataTable.tableStructure.find(table => table.tableIndex === index);
    if (!table) {
        throw new Error(`Table with index ${index} not found`);
    }
    return table;
}

// 调用时捕获异常
if (typeof tableIndex !== 'number') {
    console.error("tableIndex 未定义");
} else {
    try {
        const tableStructure = findTableStructureByIndex(tableIndex);
    } catch (error) {
        console.error(error.message);
        toastr.error(error.message); // 提示用户
    }
}

function loadSettings() {
    extension_settings.muyoo_dataTable = extension_settings.muyoo_dataTable || {};
    for (const key in defaultSettings) {
        if (!Object.hasOwn(extension_settings.muyoo_dataTable, key)) {
            extension_settings.muyoo_dataTable[key] = defaultSettings[key];
        }
    }
    extension_settings.muyoo_dataTable.message_template = defaultSettings.message_template
    $(`#dataTable_injection_mode option[value="${extension_settings.muyoo_dataTable.injection_mode}"]`).attr('selected', true);
    $('#dataTable_deep').val(extension_settings.muyoo_dataTable.deep);
    $('#dataTable_message_template').val(extension_settings.muyoo_dataTable.message_template);
}

function resetSettings() {
    extension_settings.muyoo_dataTable = { ...defaultSettings };
    loadSettings();
    saveSettingsDebounced();
    toastr.success('已重置设置');
}

function initAllTable() {
    return extension_settings.muyoo_dataTable.tableStructure.map(data => new Table(data.tableName, data.tableIndex, data.columns, data.note))
}

function checkPrototype(dataTable) {
    for (let i = 0; i < dataTable.length; i++) {
        if (!(dataTable[i] instanceof Table)) {
            const table = dataTable[i]
            dataTable[i] = new Table(table.tableName, table.tableIndex, table.columns, table.note, table.content)
        }
    }
}

/**
 * 寻找最新的表格数据，并根据关键词动态裁剪
 * @param isIncludeEndIndex 搜索时是否包含endIndex
 * @param endIndex 结束索引，自此索引向上寻找，默认是最新的消息索引
 * @param keywords 当前对话中的关键词（如角色名、地点等）
 * @returns 裁剪后的表格数据
 */
let cachedTableData = { index: -1, data: null }; // 全局缓存

function calculateChatHash(chat) {
    return chat.map(msg => msg.is_user + msg.dataTable).join('|').hashCode(); // 计算一个哈希值
}

function findLastestTableData(isIncludeEndIndex = false, endIndex = -1, keywords = []) {
    const chat = getContext().chat;
    if (endIndex === -1) endIndex = chat.length - 1;
    
    // 计算当前哈希值
    const currentChatHash = calculateChatHash(chat);

    if (cachedTableData.index >= endIndex && cachedTableData.data && cachedTableData.chatHash === currentChatHash) {
        console.log("使用缓存数据");
        return filterTableByKeywords(cachedTableData.data, keywords);
    }

    let left = 0, right = endIndex;
    let latestData = null;
    while (left <= right) {  // ✅ 二分查找
        let mid = Math.floor((left + right) / 2);
        if (chat[mid].is_user === false && chat[mid].dataTable) {
            checkPrototype(chat[mid].dataTable);
            latestData = chat[mid].dataTable;
            right = mid - 1; // 继续往前找
        } else {
            left = mid + 1;
        }
    }

    if (latestData) {
        cachedTableData = { index: endIndex, data: latestData, chatHash: currentChatHash };
        console.log("更新缓存数据");
    } else {
        cachedTableData = { index: -1, data: null, chatHash: null };
    }

    return filterTableByKeywords(latestData || initAllTable(), keywords);
}

/**
 * 根据关键词过滤表格数据
 * @param table 表格对象
 * @param keywords 关键词列表
 * @returns 过滤后的表格对象
 */
 
function filterTableByKeywords(table, keywords, targetColumns) {

    // 日期范围过滤逻辑
    const dateRange = keywords.find(k => k.startsWith("date:"));
    if (dateRange) {
        const [start, end] = dateRange.split(':')[1].split('-');
        return table.content.filter(row => {
            const date = row[targetColumns.indexOf('日期')];
            return date >= start && date <= end;
        });
    }

    const keywordSet = new Set(keywords); // 使用 Set 提高查找性能
    return table.content.filter(row =>
        targetColumns.some(colIndex => {
            const cellValue = row[colIndex]?.toString() || '';
            return keywordSet.has(cellValue);
        })
    );
}

// 调用示例：只匹配第0列和第3列
const filtered = filterTableByKeywords(table, ['惠惠', '悠悠'], [0, 3]);

/**
 * 寻找下一个含有表格数据的消息，如寻找不到，则返回null
 * @param startIndex 开始寻找的索引
 * @returns 寻找到的mes数据
 */
function findNextChatWhitTableData(startIndex) {
    const chat = getContext().chat
    for (let i = startIndex; i < chat.length; i++) {

        if (chat[i].is_user === false && chat[i].dataTable) {
            checkPrototype(chat[i].dataTable)
            return { index: i, chat: chat[i] }
        }
    }
    return { index: - 1, chat: null }
}


export function initTableData() {
    const tables = findLastestTableData(true)
    const promptContent = getAllPrompt(tables)
    console.log("完整提示", promptContent)
    return promptContent
}

function getAllPrompt(tables) {
    const compressedData = tables.reduce((acc, table) => {
        const tableData = table.content.reduce((rowAcc, row, rowIndex) => {
            const rowData = table.columns.reduce((colAcc, colName, colIndex) => {
                colAcc[colName] = row[colIndex] || '';
                return colAcc;
            }, {});
            rowAcc[`row${rowIndex}`] = rowData;
            return rowAcc;
        }, {});
        acc[table.tableName] = tableData;
        return acc;
    }, {});

    const compressedPrompt = JSON.stringify(compressedData, null, 2);
    return extension_settings.muyoo_dataTable.message_template.replace('{{tableData}}', compressedPrompt);
}

import _ from 'lodash';

function copyTableList(tableList) {
    // 使用lodash.cloneDeep替代JSON深拷贝
    return tableList.map(table => new Table(
        table.tableName,
        table.tableIndex,
        table.columns,
        table.note,
        _.cloneDeep(table.content) // 高效深拷贝
    ));
}

function getEmptyTablePrompt(Required, node) {
    return '（此表格为空' + (Required ? (node ? ('，' + node) : '') : '') + '）\n'
}

function getTableEditRules(structure, isEmpty) {
    if (structure.Required && isEmpty) return '【增删改触发条件】\n插入：' + structure.initNode + '\n'
    else {
        let editRules = '【增删改触发条件】\n'
        if (structure.insertNode) editRules += ('插入：' + structure.insertNode + '\n')
        if (structure.updateNode) editRules += ('更新：' + structure.updateNode + '\n')
        if (structure.deleteNode) editRules += ('删除：' + structure.deleteNode + '\n')
        return editRules
    }
}


calculateDiff(oldData, newData) {
        const diffs = [];
        oldData.content.forEach((oldRow, rowIndex) => {
            const newRow = newData.content[rowIndex];
            if (!newRow) return;
            oldRow.forEach((cell, colIndex) => {
                if (cell !== newRow[colIndex]) {
                    diffs.push({
                        row: rowIndex,
                        col: colIndex,
                        old: cell,
                        new: newRow[colIndex]
                    });
                }
            });
        });
        return diffs;
    }

    // 渲染差异高亮界面
    render() {
        const html = this.diffs.map(d => `
            <div class="diff-item">
                行${d.row} 列${d.col}:
                <del>${d.old}</del> → <ins>${d.new}</ins>
            </div>
        `).join('');
        return Popup.show(html, { title: "版本对比" });
    }
}


class Table {
    batchInsert(rows) {
        if (!Array.isArray(rows)) return;
        this.content.push(...rows.map(row => this._validateRow(row)));
        this.saveVersion('batch_insert', 'user');
    }

    batchDelete(rowIndices) {
        rowIndices.sort((a, b) => b - a); // 倒序删除避免索引错位
        rowIndices.forEach(i => this.content.splice(i, 1));
        this.saveVersion('batch_delete', 'user');
    }

    _validateRow(row) {
        return row.map(cell => this.handleCellValue(cell));
    }
}


class Table {
    constructor() {
        this.rows = new Map(); // key = rowIndex, value = rowData
    }
}


    // 保存当前版本
    saveVersion(operationType, operator) {
        const version = {
            versionId: Date.now(),
            operationType,
            operator,
            timestamp: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(this.content)),
        };
        this.versions.push(version);
    }

    // 按需加载版本数据
    async loadVersionData(versionId) {
        if (this.versionDataCache[versionId]) {
            return this.versionDataCache[versionId];
        }

        // 模拟异步加载（实际可以从数据库或其他存储中读取）
        return new Promise((resolve) => {
            setTimeout(() => {
                const versionData = JSON.parse(localStorage.getItem(`table_${this.tableIndex}_version_${versionId}`));
                this.versionDataCache[versionId] = versionData;
                resolve(versionData);
            }, 500); // 模拟延迟
        });
    }
    
    // 恢复到指定版本
    async restoreVersion(versionId) {
        const versionData = await this.loadVersionData(versionId);
        if (versionData) {
            this.content = JSON.parse(JSON.stringify(versionData));
        }
    }

    // 异步渲染表格DOM
     async function renderAsync() {
    return new Promise((resolve) => {
        const container = document.createElement('div');
        container.classList.add('justifyLeft', 'scrollable');
        const title = document.createElement('h3');
        title.innerText = this.tableName;
        const table = document.createElement('table');
        table.classList.add('tableDom');
        const thead = document.createElement('thead');
        const titleTr = document.createElement('tr');
        this.columns.forEach(colName => {
            const th = document.createElement('th');
            th.innerText = colName;
            titleTr.appendChild(th);
        });
        thead.appendChild(titleTr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        for (let row of this.content) {
            const tr = document.createElement('tr');
            for (let cell of row) {
                const td = document.createElement('td');
                td.innerText = cell;
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        container.appendChild(title);
        container.appendChild(table);
        resolve(container); 
    });
}


    // 在Table类中添加列操作方法
    addColumn(colName, colIndex) {
        if (this.columns.includes(colName)) return;
        this.columns.splice(colIndex, 0, colName);
        this.content.forEach(row => row.splice(colIndex, 0, '')); // 为所有行添加空列
    }

    removeColumn(colIndex) {
        if (colIndex >= this.columns.length) return;
        this.columns.splice(colIndex, 1);
        this.content.forEach(row => row.splice(colIndex, 1)); // 删除所有行的对应列
    }
}


    getTableText() {
        const structure = findTableStructureByIndex(this.tableIndex)
        if (!structure) return
        const title = `* ${this.tableIndex}:${this.tableName}\n`
        const node = this.note && this.note !== '' ? '【说明】' + this.note + '\n' : ''
        const headers = "rowIndex," + this.columns.map((colName, index) => index + ':' + colName).join(',') + '\n'
        const rows = this.content.length > 0 ? (this.content.map((row, index) => index + ',' + row.join(',')).join('\n') + '\n') : getEmptyTablePrompt(structure.Required, structure.initNode)
        return title + node + '【表格内容】\n' + headers + rows + getTableEditRules(structure, this.content.length == 0) + '\n'
    }

    // 插入行（优化非连续键处理）
    insert(data) {
        const newRow = new Array(this.columns.length).fill(''); // 初始化空行
        Object.entries(data).forEach(([key, value]) => {
            const colIndex = parseInt(key);
            if (colIndex >= 0 && colIndex < this.columns.length) {
                newRow[colIndex] = this.handleCellValue(value);
            }
        });
        this.content.push(newRow);
        this.saveVersion('insert', 'system');
    }
    
    
    update(rowIndex, data) {
    if (!this.content[rowIndex]) return;
    let changed = false; // 记录是否有变化
    Object.entries(data).forEach(([key, value]) => {
        const colIndex = parseInt(key);
        if (colIndex >= 0 && colIndex < this.columns.length) {
            const newValue = this.handleCellValue(value);
            if (this.content[rowIndex][colIndex] !== newValue) { // 仅更新变化的值
                this.content[rowIndex][colIndex] = newValue;
                changed = true;
            }
        }
    });
    if (changed) {
        this.saveVersion('update', 'system'); // 只有变化时才保存版本
    }
}

    // 删除行
    delete(rowIndex) {
        if (rowIndex >= 0 && rowIndex < this.content.length) {
            this.content.splice(rowIndex, 1);
            this.saveVersion('delete', 'system');
        }
    }
    
    
    // 处理单元格值
    handleCellValue(cell) {
        if (typeof cell === 'string') {
            return cell.replace(/,/g, "/");
        } else if (typeof cell === 'number') {
            return cell;
        }
        return '';
    }

    // 清理空行
    clearEmpty() {
        this.content = this.content.filter(row => row.some(cell => cell !== ''));
    }

    render() {
        const container = document.createElement('div')
        container.classList.add('justifyLeft')
        container.classList.add('scrollable')
        const title = document.createElement('h3')
        title.innerText = this.tableName
        // 创建虚拟滚动容器
        const virtualContainer = document.createElement('div');
        virtualContainer.style.height = '500px';
        virtualContainer.style.overflowY = 'auto';
        virtualContainer.classList.add('virtual-scroll-container');
        
        // 创建内容占位层（总高度 = 行数 * 行高）
        const contentLayer = document.createElement('div');
        contentLayer.style.height = `${this.content.length * 30}px`; // 假设每行高度30px
        contentLayer.style.position = 'relative';
        
        // 初始渲染可见区域（前20行）
        const visibleRows = this.content.slice(0, 20);
        visibleRows.forEach((row, index) => {
            const rowElement = this._createRowElement(row, index);
            contentLayer.appendChild(rowElement);
        });
        
        // 滚动事件监听（动态加载行）
        virtualContainer.addEventListener('scroll', _.throttle(() => {
            const scrollTop = virtualContainer.scrollTop;
            const startIndex = Math.floor(scrollTop / 30); // 计算起始行
            const endIndex = startIndex + 20; // 每次渲染20行
            
            // 清空旧内容
            contentLayer.innerHTML = '';
            
            // 渲染新可见区域
            this.content.slice(startIndex, endIndex).forEach((row, index) => {
                const rowElement = this._createRowElement(row, startIndex + index);
                contentLayer.appendChild(rowElement);
            });
        }, 100));
        
        virtualContainer.addEventListener('scroll', _.throttle(() => {
        const scrollTop = virtualContainer.scrollTop;
        const startIndex = Math.max(0, Math.floor(scrollTop / 30) - 5); // 增加5行缓冲
        const endIndex = startIndex + 25; // 多渲染5行避免滚动空白
        
        // ▼▼▼ 优化点：复用现有元素 ▼▼▼
        const existingRows = contentLayer.querySelectorAll('tr');
        existingRows.forEach(row => row.remove());

        // 渲染新可见区域（保留key避免重复创建）
        this.content.slice(startIndex, endIndex).forEach((row, index) => {
            const rowKey = startIndex + index;
            const rowElement = this._createRowElement(row, rowKey);
            contentLayer.appendChild(rowElement);
        });
    }, 100));
}

async function onChatChanged() {
    const chatMetadata = getContext().chatMetadata;
}


function modifyTable(tableIndex, modifyFunc) {
    if (!waitingTable || !waitingTable[tableIndex]) {
        throw new Error(`Table with index ${tableIndex} not found`);
    }
    
    let tableCopy = JSON.parse(JSON.stringify(waitingTable[tableIndex]));  // ✅ 创建表格副本，防止数据被意外修改
    modifyFunc(tableCopy);  // ✅ 在副本上执行修改
    waitingTable[tableIndex] = tableCopy;  // ✅ 修改完成后，更新回去
}

function insertRow(tableIndex, data) {
    // 增加类型和范围校验
    if (typeof tableIndex !== 'number' || tableIndex < 0) { // 校验索引是否为非负数字
        console.error("非法tableIndex:", tableIndex);
        return;
    }
    if (!waitingTable[tableIndex]) { // 校验表格是否存在
        console.error(`表格${tableIndex}不存在`);
        return; 
    }
    if (typeof data !== 'object' || Array.isArray(data)) {
        console.error("data必须是对象类型");
        return;
    }
    // 校验列索引是否合法
    const table = waitingTable[tableIndex];
    const maxColIndex = table.columns.length - 1;
    if (Object.keys(data).some(key => {
        const colIndex = parseInt(key);
        return colIndex < 0 || colIndex > maxColIndex;
    })) {
        console.error("列索引超出范围");
        return;
    }
    modifyTable(tableIndex, (table) => table.insert(data));
}

function deleteRow(tableIndex, rowIndex) {
    // 增加行索引校验
    if (typeof rowIndex !== 'number' || rowIndex < 0) {
        console.error("非法rowIndex:", rowIndex);
        return;
    }
    const table = waitingTable[tableIndex];
    if (!table || rowIndex >= table.content.length) { // 校验行是否存在
        console.error(`行${rowIndex}不存在`);
        return;
    }
    modifyTable(tableIndex, (table) => table.delete(rowIndex));
}

function updateRow(tableIndex, rowIndex, data) {
    if (typeof tableIndex !== 'number') {
        console.error("tableIndex 必须是一个数字");
        return;
    }
    if (typeof rowIndex !== 'number') {
        console.error("rowIndex 必须是一个数字");
        return;
    }
    if (typeof data !== 'object' || Array.isArray(data)) {
        console.error("data 必须是一个对象");
        return;
    }
    modifyTable(tableIndex, (table) => table.update(rowIndex, data));
}

function handleTableEditTag(matches) {
    let functionList = []
    matches.forEach(match => {
        const functionStr = trimString(match)
        const newFunctionList = functionStr.split('\n').map(str => str.trim()).filter(str => str !== '')
        functionList = functionList.concat(newFunctionList)
    })
    return functionList
}

function isTableEditStrChanged(chat, matches) {
    if (chat.tableEditMatches != null && chat.tableEditMatches.join('') === matches.join('')) {
        return false
    }
    chat.tableEditMatches = matches
    return true
}

let currentPage = 0;
const PAGE_SIZE = 10; // 每页显示10个版本

function renderVersionHistory(table) {
    const container = document.createElement('div');
    container.classList.add('version-history');
    container.dataset.tableIndex = table.tableIndex;

    // 只渲染当前页的版本，避免一次性加载过多数据导致性能问题
    const startIndex = currentPage * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const versionsToRender = table.versions.slice(startIndex, endIndex);

    versionsToRender.forEach(version => {
        const versionItem = document.createElement('div');
        versionItem.classList.add('version-item');
        versionItem.innerHTML = `
            <p>版本号: ${version.versionId}</p>
            <p>操作类型: ${version.operationType}</p>
            <p>操作时间: ${version.timestamp}</p>
            <p>操作者: ${version.operator}</p>
            <button class="restore-btn" data-version-id="${version.versionId}">恢复</button>
        `;
        container.appendChild(versionItem);
    });

    // 滚动加载更多版本
    container.addEventListener('scroll', () => {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight) {
            currentPage++;
            renderVersionHistory(table);
        }
    });

    return container;
}

function executeTableEditFunction(functionList) {
    functionList.forEach(functionStr => {
        const newFunctionStr = fixFunctionNameError(functionStr)
        if (!newFunctionStr) return
        
        try {
            eval(newFunctionStr)
        } catch (e) {
            toastr.error('表格操作函数执行错误，请重新生成本轮文本\n错误语句：' + functionStr + '\n错误信息：' + e.message);
        }
    })
}



function compareVersions(tableIndex, versionId1, versionId2) {
       const table = waitingTable[tableIndex];
       const version1 = table.versions.find(v => v.versionId === versionId1);
       const version2 = table.versions.find(v => v.versionId === versionId2);

       if (version1 && version2) {
           const diff = [];
           version1.data.forEach((row1, rowIndex) => {
               const row2 = version2.data[rowIndex];
               row1.forEach((cell1, colIndex) => {
                   const cell2 = row2[colIndex];
                   if (cell1 !== cell2) {
                       diff.push({
                           rowIndex,
                           colIndex,
                           oldValue: cell1,
                           newValue: cell2,
                       });
                   }
               });
           });
           return diff;
       }
       return [];
   }


function fixFunctionNameError(str) {
    if (str.startsWith("update("))
        return str.replace("update(", "updateRow(");
    if (str.startsWith("insert("))
        return str.replace("insert(", "insertRow(");
    if (str.startsWith("delete("))
        return str.replace("delete(", "deleteRow(");
    if (str.startsWith("updateRow(") || str.startsWith("insertRow(") || str.startsWith("deleteRow(")) return str
    return
}

function handleEditStrInMessage(chat, mesIndex = -1, ignoreCheck = false) {
    const { matches, updatedText } = getTableEditTag(chat.mes)
    if (!ignoreCheck && !isTableEditStrChanged(chat, matches)) return
    const functionList = handleTableEditTag(matches)
    if (functionList.length === 0) return
    // 寻找最近的表格数据
    waitingTable = copyTableList(findLastestTableData(false, mesIndex))
    // 对最近的表格执行操作
    executeTableEditFunction(functionList)
    clearEmpty()
    chat.dataTable = waitingTable
    // 如果不是最新的消息，则更新接下来的表格
    if (mesIndex !== -1) {
        const { index, chat: nextChat } = findNextChatWhitTableData(mesIndex + 1)
        if (index !== -1) handleEditStrInMessage(nextChat, index, true)
    }
}

function getRealIndexInCollectionInDryRun(identifier, collection) {
    const newCollection = collection.filter(Boolean).filter(item => item.collection && item.collection.length !== 0)
    let index = 0
    for (let i in newCollection) {
        if (newCollection[i].identifier === identifier) break
        const newMes = newCollection[i].collection.filter((mes) => mes.content !== '')
        index += newMes.length
    }
    return index
}

function getRealIndexInCollection(identifier, collection) {
    const excludeList = ['newMainChat', 'newChat', 'groupNudge'];
    let index = 0;
    
    for (let i in collection) {
        if (collection[i].identifier === identifier) {
            return index;
        }
        if (!excludeList.includes(collection[i].identifier)) {
            index++;
        }
    }
    return -1; // 如果没找到返回-1
}

function getMesRole() {
    switch (extension_settings.muyoo_dataTable.injection_mode) {
        case 'deep_system':
            return 'system'
        case 'deep_user':
            return 'user'
        case 'deep_assistant':
            return 'assistant'
    }
}

async function onChatCompletionPromptReady(eventData) {
    if (eventData.dryRun === true) return
    const promptContent = initTableData()
    eventData.chat.splice(extension_settings.muyoo_dataTable.deep, 0, { role: getMesRole(), content: promptContent })
    /* console.log("dryRun", eventData.dryRun)
    console.log("chatCompletionPromptReady", promptManager)
    const prompts = promptManager.getPromptCollection();
    const systemPrompt = { role: 'system', content: promptContent, identifier: 'groupNudge' }
    const markerIndex = prompts.index("tableData");
    const newPrompt = promptManager.preparePrompt(systemPrompt);
    const message = await Message.fromPromptAsync(newPrompt);
    const messageCollection = new MessageCollection("tableData", message)
    if (promptManager.messages.collection[markerIndex] == null) promptManager.messages.collection[markerIndex] = messageCollection;
    if (false === eventData.dryRun) promptManager.render(false)
    const realIndex = getRealIndexInCollectionInDryRun('tableData', promptManager.messages.collection)
    eventData.chat.splice(realIndex, 0, { role: "system", content: promptContent }) */
}

function trimString(str) {
    return str.replace(/^\s*<!--([\s\S]*?)-->\s*$/, "$1").trim();
    }

function getTableEditTag(mes) {
    const regex = /<tableEdit>([\s\S]*?)<\/tableEdit>/gs; // 使用[\s\S]匹配任意字符（包括换行符）
    const matches = [];
    let match;
    // 重置正则状态，防止死循环
    regex.lastIndex = 0;  
    while ((match = regex.exec(mes)) !== null) {
        matches.push(match[1]);
    }
    const updatedText = mes.replace(regex, "");
    return { matches, updatedText };
}

/**
 * 消息编辑时触发
 * @param this_edit_mes_id 此消息的ID
 */
async function onMessageEdited(this_edit_mes_id) {
    const chat = getContext().chat[this_edit_mes_id]
    handleEditStrInMessage(chat, parseInt(this_edit_mes_id))
}

/**
 * 消息接收时触发
 * @param {*} chat_id 此消息的ID
 */
async function onMessageReceived(chat_id) {
    const chat = getContext().chat[chat_id];
    handleEditStrInMessage(chat)
}

async function openTablePopup(mesId = -1) {
    const manager = await renderExtensionTemplateAsync('third-party/st-memory-enhancement', 'manager');
    tablePopup = new Popup(manager, POPUP_TYPE.TEXT, '', { large: true, wide: true, allowVerticalScrolling: true });
    tablePopup.dlg.addEventListener('focusin', () => renderTableData(mesId))
    await tablePopup.show()
}

// 异步渲染表格数据
async function renderTableDataAsync(mesId = -1) {
    const tableContainer = document.getElementById('tableContainer');
    tableContainer.innerHTML = '<div class="loading-spinner">加载中...</div>';
    
    try {
        // 修改后的Promise：添加.catch()捕获异步错误
        const tables = await new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    // 原有的数据加载逻辑
                    resolve(findLastestTableData(true, mesId));
                } catch (e) {
                    // 捕获同步错误并通过reject传递
                    reject(new Error("加载表格数据失败: " + e.message));
                }
            }, 100);
        }).catch(error => {
            // 统一处理Promise链中的错误
            throw new Error("异步操作错误: " + error.message);
        });
        
        // 清空加载动画
        tableContainer.innerHTML = '';
        for (let table of tables) {
            tableContainer.appendChild(await table.renderAsync());
        }
    } catch (error) {
        // 统一处理所有异常
        console.error("渲染错误:", error);
        toastr.error("错误: " + error.message);
        tableContainer.innerHTML = '<div class="error">加载失败，请重试</div>';
    }
}

async function updateTablePlugin() {

}

jQuery(async () => {
    fetch("http://api.muyoo.com.cn/check-version", {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientVersion: '1.0.2' })
    }).then(res => res.json()).then(res => {
        if (res.success) {
            if (!res.isLatest) $("#tableUpdateTag").show()
            if (res.toastr) toastr.warning(res.toastrText)
            if (res.message) $("#table_message_tip").text(res.message)
        }
    })
    const html = await renderExtensionTemplateAsync('third-party/st-memory-enhancement', 'index');
    const buttonHtml = await renderExtensionTemplateAsync('third-party/st-memory-enhancement', 'buttons');
    const button = `
    <div title="查看表格" class="mes_button open_table_by_id">
        表格
    </div>`;
    $('#data_bank_wand_container').append(buttonHtml);
    $('.extraMesButtons').append(button);
    $('#translation_container').append(html);
    $(document).on('pointerup', '.open_table_by_id', function () {
        try {
            const messageId = $(this).closest('.mes').attr('mesid');
            openTablePopup(parseInt(messageId));
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    });
    loadSettings();
    $('#dataTable_injection_mode').on('change', (event) => {
        extension_settings.muyoo_dataTable.injection_mode = event.target.value;
        saveSettingsDebounced();
    });
    $('#dataTable_message_template').on("input", function () {
        const value = $(this).val();
        extension_settings.muyoo_dataTable.message_template = value;
        saveSettingsDebounced();
    })
    $('#dataTable_deep').on("input", function () {
        const value = $(this).val();
        extension_settings.muyoo_dataTable.deep = value;
        saveSettingsDebounced();
    })
    $("#open_table").on('click', () => openTablePopup());
    $("#reset_settings").on('click', () => resetSettings());
    $("#table_update_button").on('click', updateTablePlugin);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, onChatCompletionPromptReady);
    eventSource.on(event_types.MESSAGE_EDITED, onMessageEdited);
});
