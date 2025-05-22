document.addEventListener('DOMContentLoaded', () => {
    const notification = document.getElementById('fullscreen-notification');
    const closeButton = document.getElementById('close-notification');
    const countdown = document.getElementById('countdown');
    let timeLeft = 5;
    
    const countdownInterval = setInterval(() => {
        timeLeft--;
        countdown.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            closeButton.disabled = false;
            countdown.style.display = 'none';
        }
    }, 1000);
    
    closeButton.addEventListener('click', () => {
        notification.style.display = 'none';
    });

    const excelFileInput = document.getElementById('excelFile');
    const searchInput = document.getElementById('searchInput');
    const checkButton = document.getElementById('checkButton');
    const dataTableBody = document.querySelector('#dataTable tbody');
    const noDataMessage = document.getElementById('noDataMessage');
    const downloadButton = document.getElementById('downloadButton');

    let tableData = [];

    excelFileInput.addEventListener('change', handleFileSelect);

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const data = new Uint8Array(e.target.result);
                try {
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });

                    tableData = jsonData.map(item => ({
                        '姓名': String(item['姓名'] || '').trim(),
                        '学号': String(item['学号'] || '').trim(),
                        '周边': (item['周边'] === 1 || String(item['周边']).trim() === '1' || String(item['周边']).trim().toLowerCase() === 'true') ? 1 : 0,
                        '签到状态': (item['签到状态'] === 1 || String(item['签到状态']).trim() === '1' || String(item['签到状态']).trim() === '1.0') ? '1' : ''
                    }));
                    renderTable();
                    noDataMessage.textContent = "数据已加载。";
                } catch (err) {
                    console.error("Error processing Excel file:", err);
                    customAlert("无法处理Excel文件。请确保文件格式正确，并且包含'姓名', '学号', '周边', '签到状态'列。");
                    tableData = [];
                    renderTable();
                    noDataMessage.textContent = "文件处理失败，请重试。";
                }
            };
            reader.onerror = function(err) {
                console.error("FileReader error:", err);
                customAlert("读取文件时发生错误。");
                noDataMessage.textContent = "文件读取失败，请重试。";
            };
            reader.readAsArrayBuffer(file);
        } else {
            tableData = [];
            renderTable();
            noDataMessage.textContent = "请先上传 Input.xlsx 文件。";
        }
    }

    downloadButton.addEventListener('click', async () => {
        if (tableData.length === 0) {
            await customAlert("没有数据可以下载。");
            return;
        }
        try {
            const dataToExport = tableData.map(item => ({
                '姓名': item['姓名'],
                '学号': item['学号'],
                '周边': item['周边'],
                '签到状态': item['签到状态']
            }));

            const worksheet = XLSX.utils.json_to_sheet(dataToExport, {
                header: ['姓名', '学号', '周边', '签到状态']
            });
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "签到数据");

            XLSX.writeFile(workbook, "out.xlsx");
        } catch (err) {
            console.error("Error creating Excel for download:", err);
            await customAlert("创建下载文件时出错。");
        }
    });


    function renderTable() {
        dataTableBody.innerHTML = '';
        if (tableData.length === 0) {
            noDataMessage.style.display = 'block';
            if (!excelFileInput.files || excelFileInput.files.length === 0) {
                 noDataMessage.textContent = "请先上传签到Excel表。";
            } else {
                 noDataMessage.textContent = "Excel文件中没有数据或数据无法解析。";
            }
            return;
        }
        noDataMessage.style.display = 'none';

        tableData.forEach((item, index) => {
            const row = dataTableBody.insertRow();
            row.dataset.rowIndex = index;

            if (item['签到状态'] === '1') {
                row.classList.add('status-signed-in');
            } else {
                row.classList.add('status-not-signed-in');
            }

            const cellName = row.insertCell();
            cellName.textContent = item['姓名'] || 'N/A';
            const cellNumber = row.insertCell();
            cellNumber.textContent = item['学号'] || 'N/A';
            const cellPeripheral = row.insertCell();
            cellPeripheral.textContent = (item['周边'] === 1) ? '有' : '无';
            const cellStatus = row.insertCell();
            cellStatus.textContent = (item['签到状态'] === '1') ? '已签到' : '未签到';

            row.addEventListener('click', () => handleRowClick(index));
        });
    }

    async function handleCheckIn() {
        if (tableData.length === 0) {
            await customAlert("请先加载数据。");
            return;
        }
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (!searchTerm) {
            await customAlert('请输入姓名或学号进行查询。');
            return;
        }

        let foundRecord = null;

        for (let i = 0; i < tableData.length; i++) {
            const name = String(tableData[i]['姓名'] || '').toLowerCase();
            const studentId = String(tableData[i]['学号'] || '').toLowerCase();

            if (name === searchTerm || studentId === searchTerm) {
                foundRecord = tableData[i];
                break;
            }
        }

        if (foundRecord) {
            const peripheralText = (foundRecord['周边'] === 1) ? '有周边' : '无周边';
            let message = `姓名：${foundRecord['姓名']}\n学号：${foundRecord['学号']}\n${peripheralText}\n`;

            if (foundRecord['签到状态'] === '1') {
                message += '该用户已签到。';
            } else {
                foundRecord['签到状态'] = '1';
                message += '签到成功！';
                renderTable();
            }
            await customAlert(message);
            searchInput.value = '';
        } else {
            await customAlert('签到失败。\n未找到匹配的姓名或学号。');
        }
    }

    async function handleRowClick(index) {
        if (tableData.length === 0 || index < 0 || index >= tableData.length) return;

        const record = tableData[index];
        const currentStatusIsOne = record['签到状态'] === '1';
        const actionConfirm = currentStatusIsOne ? '取消签到' : '标记为已签到';

        const confirmResult = await customConfirm(`姓名：${record['姓名']}\n学号：${record['学号']}\n\n确定要"${actionConfirm}"吗？`);
        if (confirmResult) {
            record['签到状态'] = currentStatusIsOne ? '' : '1';
            renderTable();
        }
    }

    checkButton.addEventListener('click', handleCheckIn);
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleCheckIn();
        }
    });

    renderTable();
});

document.addEventListener("DOMContentLoaded", function() {
    const fileInput = document.getElementById("excelFile");
    const customButton = document.getElementById("customUploadButton");
    const fileNameDisplay = document.getElementById("fileName");
    
    customButton.addEventListener("click", function() {
        fileInput.click();
    });
    
    fileInput.addEventListener("change", function() {
        if (this.files && this.files[0]) {
            fileNameDisplay.textContent = this.files[0].name;
        } else {
            fileNameDisplay.textContent = "未选择文件";
        }
    });
});

(function() {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');

    window.customAlert = function(message, title = 'Note') {
        return new Promise(resolve => {
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            modalCancel.style.display = 'none';
            modalConfirm.style.display = 'block';
            modal.classList.add('show', 'modal-alert');
            
            const handleConfirm = () => {
                modal.classList.remove('show', 'modal-alert');
                modalConfirm.removeEventListener('click', handleConfirm);
                resolve();
            };
            
            modalConfirm.addEventListener('click', handleConfirm);
        });
    };

    window.customConfirm = function(message, title = 'Confirm') {
        return new Promise(resolve => {
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            modalCancel.style.display = 'block';
            modalConfirm.style.display = 'block';
            modal.classList.add('show');
            
            const handleConfirm = () => {
                modal.classList.remove('show');
                modalConfirm.removeEventListener('click', handleConfirm);
                modalCancel.removeEventListener('click', handleCancel);
                resolve(true);
            };
            
            const handleCancel = () => {
                modal.classList.remove('show');
                modalConfirm.removeEventListener('click', handleConfirm);
                modalCancel.removeEventListener('click', handleCancel);
                resolve(false);
            };
            
            modalConfirm.addEventListener('click', handleConfirm);
            modalCancel.addEventListener('click', handleCancel);
        });
    };
})();