async initialize() {
     try {
       this.rooms = await this.roomService.getRooms(this.propertyId);
       const isAdmin = this.container.dataset.isAdmin === 'true';
       console.debug('RoomList: Initializing', {
         propertyId: this.propertyId,
         isAdmin,
         roomCount: this.rooms.length
       });
       this.isAdmin = isAdmin;
       this.render();
       this.attachEventListeners();
     } catch (error) {
   }

   render(errorMessage = null) {
     if (errorMessage) {
       this.container.innerHTML = `
         <div class="alert alert-danger">${errorMessage}</div>
       `;
       return;
     }

     this.container.innerHTML = `
       <div class="d-flex justify-content-between align-items-center mb-3">
         <h4 class="h5 mb-0">Rooms</h4>
         ${this.isAdmin ? `
         <button class="btn btn-outline-primary btn-sm" id="addRoomBtn">
           ${IconService.createIcon('Plus')} Add Room
         </button>
         ` : ''}
       </div>

   renderRoom(room) {
     const isAdmin = this.container.dataset.isAdmin === 'true';
     console.debug('RoomList: Rendering room', {
       roomId: room.id,
       roomName: room.name,
       isAdmin
     });
     return `
       <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center room-item"
            data-room-id="${room.id}"