// Batch import feature
// Owns participant registration modal reset and bulk import execution.

window.openBatchModal = () => {
    const data = getData();
    
    let members = [];
    let grade1 = [], grade2 = [], grade3 = [], grade4 = [];
    let drivers = [];

    data.waiting.forEach(m => {
        if(m.grade===1) grade1.push(m.name);
        else if(m.grade===2) grade2.push(m.name);
        else if(m.grade===3) grade3.push(m.name);
        else if(m.grade===4) grade4.push(m.name);
        else members.push(m.name);
    });

    data.cars.forEach(c => {
        drivers.push(c.name);
        c.members.forEach(m => {
            if(m && m.name) {
                if(m.grade===1) grade1.push(m.name);
                else if(m.grade===2) grade2.push(m.name);
                else if(m.grade===3) grade3.push(m.name);
                else if(m.grade===4) grade4.push(m.name);
                else members.push(m.name);
            }
        });
    });

    $('#batchMembers').value = members.join('\n');
    $('#batchGrade1').value = grade1.join('\n');
    $('#batchGrade2').value = grade2.join('\n');
    $('#batchGrade3').value = grade3.join('\n');
    $('#batchGrade4').value = grade4.join('\n');
    $('#batchDrivers').value = drivers.join('\n');
    
    modals.batch.show();
}

async function executeBatch() {
    const cleanName = value => String(value || '').replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
    const v = id => $(id).value.split(/\n/).map(cleanName).filter(Boolean);
    const m = v('#batchMembers');
    const g1 = v('#batchGrade1');
    const g2 = v('#batchGrade2');
    const g3 = v('#batchGrade3');
    const g4 = v('#batchGrade4');
    const d = v('#batchDrivers');
    const allEntries = [
        ...m.map(name => ({name, group:'同乗者'})),
        ...g1.map(name => ({name, group:'1年生'})),
        ...g2.map(name => ({name, group:'2年生'})),
        ...g3.map(name => ({name, group:'3年生'})),
        ...g4.map(name => ({name, group:'4年生'})),
        ...d.map(name => ({name, group:'車出し'}))
    ];
    const grouped = allEntries.reduce((acc, item) => {
        acc[item.name] = acc[item.name] || [];
        acc[item.name].push(item.group);
        return acc;
    }, {});
    const duplicates = Object.entries(grouped).filter(([, groups]) => groups.length > 1);
    const warning = byId('batchDuplicateWarning');
    if (duplicates.length) {
        const message = '同じ名前があります：' + duplicates.map(([name, groups]) => `${name}（${groups.join('・')}）`).join('、');
        if (warning) {
            warning.style.display = 'block';
            warning.textContent = message;
        }
        await appAlert(message + '\n重複を直してから登録してください。', { title: '重複があります' });
        return;
    } else if (warning) {
        warning.style.display = 'none';
        warning.textContent = '';
    }
    
    const currentData = getData();
    
    const existingMembers = new Map();
    const existingDrivers = new Map();
    const memberLocations = new Map();

    currentData.waiting.forEach(mem => {
        existingMembers.set(mem.name, mem);
        memberLocations.set(mem.name, {type: 'waiting'});
    });

    currentData.cars.forEach(car => {
        existingDrivers.set(car.name, car);
        car.members.forEach((mem, index) => {
             if(mem && mem.name) {
                 existingMembers.set(mem.name, mem);
                 memberLocations.set(mem.name, {type: 'car', carName: car.name, slot: index});
             }
        });
    });

    const newDriversList = new Set(d);

    $('#waiting-list').innerHTML = '';
    $('#cars-container').innerHTML = '';

    d.forEach(driverName => {
        if(existingDrivers.has(driverName)) {
            const oldCar = existingDrivers.get(driverName);
            addCar(driverName, oldCar.capacity, [], oldCar.driverMemo, oldCar.driverGender);
        } else {
            addCar(driverName, 3);
            detectGender(driverName);
        }
    });

    const carBoxes = Array.from($$('.car-box'));

    const gradeMap = new Map();
    g1.forEach(n => gradeMap.set(n, 1));
    g2.forEach(n => gradeMap.set(n, 2));
    g3.forEach(n => gradeMap.set(n, 3));
    g4.forEach(n => gradeMap.set(n, 4));
    m.forEach(n => { if(!gradeMap.has(n)) gradeMap.set(n, 0); });

    [...m, ...g1, ...g2, ...g3, ...g4].forEach(name => {
        placeMember(name, gradeMap.get(name)||0);
    });

    function placeMember(name, grade) {
        if (existingMembers.has(name)) {
            const oldData = existingMembers.get(name);
            const loc = memberLocations.get(name);
            oldData.grade = grade;

            if (loc.type === 'car' && newDriversList.has(loc.carName)) {
                const targetCarBox = carBoxes.find(b => $('.driver-name-disp', b).innerText === loc.carName);
                if (targetCarBox) {
                    const slots = $$('.seat-slot', targetCarBox);
                    if(slots[loc.slot] && slots[loc.slot].children.length === 0) {
                        addMember(name, oldData.memo, oldData.gender, grade, slots[loc.slot], oldData.locked);
                    } else {
                        const emptySlot = Array.from(slots).find(s => s.children.length === 0);
                        if(emptySlot) {
                             addMember(name, oldData.memo, oldData.gender, grade, emptySlot, oldData.locked);
                        } else {
                             addMember(name, oldData.memo, oldData.gender, grade, $('#waiting-list'), oldData.locked);
                        }
                    }
                } else {
                     addMember(name, oldData.memo, oldData.gender, grade, $('#waiting-list'), oldData.locked);
                }
            } else {
                addMember(name, oldData.memo, oldData.gender, grade, $('#waiting-list'), oldData.locked);
            }
        } else {
            addMember(name, '', 'unknown', grade, $('#waiting-list'));
            detectGender(name);
        }
    }

    save(); 
    modals.batch.hide();
}
window.executeBatch = executeBatch;
