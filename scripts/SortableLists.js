function SortableList (){
	let _state=[];
	let _currentItem;
	let _callback;

	const validDropTarget =(e) => {
		const draggedItem =document.querySelector(".sortableList .dragging");
		const sourceParent=$(draggedItem).closest(".sortableListContainer")[0]

		const dropTarget= ($(e.target).is(".sortableList") ? e.target : $(e.target).closest(".sortableList")[0]);
		const dropParent=$(dropTarget).closest(".sortableListContainer")[0]

		if(sourceParent==dropParent){
			e.preventDefault();
		}
	}
	const moveItem =(e) => {
		const t0= performance.now();
		const draggedItem =document.querySelector(".sortableList .dragging");
		const sourceParent=$(draggedItem).closest(".sortableListContainer")[0]

		const dropTarget= ($(e.target).is(".sortableList") ? e.target : $(e.target).closest(".sortableList")[0]);
		const dropParent=$(dropTarget).closest(".sortableListContainer")[0];
		const singleItemPerRowAttribute = dropTarget.getAttribute("singleItemPerRow");
		let multipleItemsPerRow=1;
		if(singleItemPerRowAttribute !==null){
			multipleItemsPerRow = (singleItemPerRowAttribute =="" || singleItemPerRowAttribute ? 0 : 1);
		}
		const sameRow= ($(e.target).is(".sortableList") ? 0 : multipleItemsPerRow);
		const destColumnName=dropTarget.title;

		console.log("finished dragging")
		let destRow;
		if(sourceParent==dropParent){
			e.preventDefault();
			const container=_state.find((container)=> container.name==draggedItem.dataset.containerName);
			const sourceColumn=container.columns.find((column)=> column.name==_currentItem.columnName);
			const destColumn=container.columns.find((column)=> column.name==destColumnName);

			//const sameColumn = (_currentItem.columnName == destColumnName)
			if(!sameRow){
				const siblings =[...dropTarget.querySelectorAll(".sortableList .listItem:not(.dragging)")];
				//console.log(siblings)
				//console.log(e.clientY)
				let nextSibling= siblings.find(sibling => {
					return e.clientY <= sibling.offsetTop + sibling.offsetHeight /2;
				})
				if (nextSibling !== undefined){
					//console.log("sibling",nextSibling.dataset);
					//destColumnName=nextSibling.dataset.column;
					destRow=nextSibling.dataset.rowIndex;
				} else {
					//console.log("last / only one in column", dropTarget.title);
					//destColumnName=dropTarget.title;
					destRow=siblings.length;
				}
				//console.log(destRow)
				const destColumn=container.columns.find((column)=> column.name==destColumnName);
				const item=sourceColumn.data[_currentItem.rowIndex].splice(_currentItem.itemIndex, 1)

				destColumn.data.splice(destRow, 0, item);
				if (sourceColumn.data[_currentItem.rowIndex].length==0){
					sourceColumn.data.splice(_currentItem.rowIndex, 1);
				}

			} else {
				//e.target.insertBefore(draggedItem, null)
				//console.log("same row", e.target.dataset);
				
				const item=sourceColumn.data[_currentItem.rowIndex].slice(_currentItem.itemIndex, 1)[0]
				destColumn.data[e.target.dataset.rowIndex].push(item)
				sourceColumn.data[_currentItem.rowIndex].splice(_currentItem.itemIndex, 1)
				if (sourceColumn.data[_currentItem.rowIndex].length==0){
					sourceColumn.data.splice(_currentItem.rowIndex, 1);
				}
				//console.log(_state)
			}
		}
		console.log("almost done move (" + (performance.now() - t0) + " ms.)");
		if(_callback){
			setTimeout(()=>_callback(_state),100);
		}
		setTimeout(RenderState,1);
		console.log("done move (" + (performance.now() - t0) + " ms.)");
	}

	const sortableListContainers = document.querySelectorAll(".sortableListContainer");
	sortableListContainers.forEach((container)=>{
		const sortableList = container.querySelectorAll(".sortableList");
		container.dataset.template=container.querySelector(".details").parentElement.innerHTML;
		console.log(container.dataset.template)
		let currentContainer={name:container.title,columns:[]}

		sortableList.forEach((list)=>{
			list.addEventListener("dragover", validDropTarget)
			list.addEventListener("dragenter", e => e.preventDefault());
			list.addEventListener("drop", moveItem);
			currentContainer.columns.push({name:list.title, data:[]});
		})
		_state.push(currentContainer)
	})

	function AddDraggableEvents(){
		const t0= performance.now();
		const items = document.querySelectorAll(".sortableList .listItem .details");
		console.log("querySelectorAll (" + (performance.now() - t0) + " ms.)");
		items.forEach(item =>{
			console.log("adding el's (" + (performance.now() - t0) + " ms.)");
			item.draggable=true;
			item.addEventListener("dragstart", () => {
				_currentItem=item.dataset;
				setTimeout(()=>item.classList.add("dragging"),0);
			})
			console.log("added first el (" + (performance.now() - t0) + " ms.)");
			item.addEventListener("dragend", () => {
				item.classList.remove("dragging");
			})
			console.log("added second el (" + (performance.now() - t0) + " ms.)");
		})
		console.log("finished AddDraggableEvents (" + (performance.now() - t0) + " ms.)");
	}

	function RenderState(){
		const t0= performance.now();
		_state.forEach((container)=>{
			const containerElement=document.querySelector(".sortableListContainer[title='"+ container.name +"']");
			container.columns.forEach((column)=>{
				const columnElement=containerElement.querySelector(".sortableList[title='"+ column.name +"']");
				const newChildren=column.data.map((items, itemIndex)=>{
					console.log("start column.data.map. (" + (performance.now() - t0) + " ms.)");
					const newLi=document.createElement("li");
					newLi.classList.add("listItem");
					newLi.dataset.columnName=column.name;
					newLi.dataset.containerName= container.name;
					newLi.dataset.rowIndex=itemIndex;
					newLi.innerHTML=items.map((item) => {
						if(typeof item == "object") {
							return Object.entries(item).reduce((prev, current)=> prev.replaceAll(`{{${current[0]}}}`, current[1]), containerElement.dataset.template)
						} else {
							return containerElement.dataset.template.replaceAll("{{item}}", item);
						}
					}).join('');
					newLi.querySelectorAll(".details").forEach((detail, index)=>{
						detail.dataset.columnName=column.name;
						detail.dataset.containerName= container.name;
						detail.dataset.rowIndex=itemIndex;
						detail.dataset.itemIndex=index;
					});

					return newLi;
				})
				console.log("start replaceChildren (" + (performance.now() - t0) + " ms.)");
				if(columnElement){
					columnElement.replaceChildren(...newChildren);
				} else {
					console.error(`Column ${column.name} not found.`);
				}
				console.log("end replaceChildren (" + (performance.now() - t0) + " ms.)");
			})
		})
		console.log("finished foreach. (" + (performance.now() - t0) + " ms.)");
		setTimeout(AddDraggableEvents, 1);
		console.log("finished AddDragableEvents. (" + (performance.now() - t0) + " ms.)");
	}

	function setState(state){
		console.log("setState")
		_state=state;
		RenderState();
	}
	function setItems(containerTitle, columnTitle, items){
		console.log("setItems")
		const container=_state.find((container)=> container.name==containerTitle);
		const column=container.columns.find((column)=> column.name==columnTitle);
		column.data=items;
		RenderState()
	}

	return {
		set state(state){ setState(state) },
		get state(){return _state},
		setItems,
		set onStateChanged(callback){
			_callback = callback;
		}
	}
}