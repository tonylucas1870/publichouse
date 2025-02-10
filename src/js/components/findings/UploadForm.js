import { IconService } from '../../services/IconService.js';
import { ImageUpload } from '../ui/ImageUpload.js';
import { RoomSelect } from '../ui/RoomSelect.js';
import { RoomDetailsService } from '../../services/RoomDetailsService.js';
import { RoomService } from '../../services/RoomService.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { validateMedia } from '../../utils/imageUtils.js';
import { convertToMP4, needsConversion } from '../../utils/videoUtils.js';
import { supabase } from '../../lib/supabase.js';

export class UploadForm {
  constructor(containerId, findingsService, findingsList, changeoverId) {
    console.debug('UploadForm: Initializing', { 
      containerId,
      hasService: !!findingsService,
      hasList: !!findingsList,
      changeoverId
    });

    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error('Upload form container not found');
    }
    this.findingsService = findingsService;
    this.findingsList = findingsList;
    this.changeoverId = changeoverId;
    this.selectedImages = [];
    this.roomSelect = null;
    this.roomDetailsService = new RoomDetailsService();
    this.isAnalyzing = false;
    
    this.render();
    this.attachEventListeners();
  }

  render() {
    this.container.innerHTML = `
      <form id="findingForm" class="needs-validation" novalidate>
        <div class="mb-3">
          <label for="description" class="form-label d-flex align-items-center gap-2">
            ${IconService.createIcon('Type')}
            Description
          </label>
          <textarea
            id="description"
            class="form-control"
            placeholder="Describe what you found..."
            required
            rows="3"
          ></textarea>
          <div class="invalid-feedback">
            Please provide a description
          </div>
        </div>

        <div id="locationContainer"></div>
        <div id="contentsContainer"></div>

        <div class="mb-4">
          <label class="form-label d-flex align-items-center gap-2">
            ${IconService.createIcon('Camera')}
            Images (Optional)
          </label>
          <div class="row g-3 mb-2" id="imagePreviewsContainer">
            <!-- Image previews will be added here -->
          </div>
          <input
            type="file"
            id="imageInput"
            accept="image/*,video/*"
            class="d-none"
            multiple
          />
          <div id="analysisStatus" class="mb-2"></div>
          <button type="button" class="btn btn-outline-primary w-100" id="addImagesBtn">
            ${IconService.createIcon('Upload')}
            Upload Images/Videos
          </button>
        </div>

        <button type="submit" class="btn btn-primary w-100">
          Submit Finding
        </button>
      </form>
    `;
  }

  attachEventListeners() {
    const form = this.container.querySelector('#findingForm');
    const imageInput = this.container.querySelector('#imageInput');
    const addImagesBtn = this.container.querySelector('#addImagesBtn');
    this.contentsSelect = null;
    this.analysisStatus = this.container.querySelector('#analysisStatus');

    // Initialize RoomSelect
    this.roomSelect = new RoomSelect('locationContainer', this.changeoverId);

    // Initialize RoomSelect
    this.roomSelect = new RoomSelect('locationContainer', this.changeoverId);

    // Handle location changes to load contents
    const locationContainer = this.container.querySelector('#locationContainer');
    const contentsContainer = this.container.querySelector('#contentsContainer');
    
    locationContainer?.addEventListener('roomchange', async (e) => {
      const room = e.detail.room;
      console.debug('UploadForm: Room changed', {
        room,
        hasContentsSelect: !!this.contentsSelect
      });

      if (!room) {
        if (contentsContainer) {
          contentsContainer.innerHTML = '';
        }
        this.contentsSelect = null;
        return;
      }
      
      try {
        // Initialize contents select
        const { ContentsSelect } = await import('../ui/ContentsSelect.js');
        
        // Create new ContentsSelect instance
        const contentsSelect = new ContentsSelect('contentsContainer', room.id);
        
        // Wait for initialization to complete
        await contentsSelect.initialize();
        
        // Store reference only after successful initialization
        this.contentsSelect = contentsSelect;
        
        console.debug('UploadForm: ContentsSelect initialized', {
          roomId: room.id,
          hasContents: contentsSelect.contents.length > 0
        });
      } catch (error) {
        console.error('Error loading room contents:', error);
        if (contentsContainer) {
          contentsContainer.innerHTML = '';
        }
        this.contentsSelect = null;
      }
    });

    addImagesBtn.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      console.debug('UploadForm: Files selected', { 
        count: files.length,
        types: files.map(f => f.type)
      });

      for (const file of files) {
        const error = validateMedia(file);
        const isVideo = file.type.startsWith('video/');
        if (error) {
          showErrorAlert(error);
          return;
        }

        let processedFile = file;

        // If it's a video, analyze it first
        if (isVideo) {
          console.debug('UploadForm: Processing video file', {
            name: file.name,
            size: file.size,
            type: file.type
          });

          // Convert MOV to MP4 if needed
          if (needsConversion(file)) {
            try {
              this.updateAnalysisStatus('Converting video format...');
              processedFile = await convertToMP4(file);
              console.debug('UploadForm: Video converted', {
                originalType: file.type,
                newType: processedFile.type
              });
            } catch (error) {
              console.error('UploadForm: Video conversion failed', error);
              showErrorAlert('Video conversion failed: ' + error.message);
              return;
            }
          }

          try {
            await this.analyzeVideo(file);
          } catch (error) {
            console.error('UploadForm: Video analysis failed', error);
            showErrorAlert('Video analysis failed: ' + error.message);
            return;
          }
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          this.selectedImages.push({
            file: processedFile,
            isVideo,
            previewUrl: e.target.result
          });
          this.updateImagePreviews();
        };
        reader.readAsDataURL(processedFile);
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
      }

      try {
        const contentItem = this.contentsSelect?.getValue();
        
        // If we have a room and content item, ensure it's added to room contents
        if (contentItem && this.roomSelect) {
          const roomName = this.roomSelect.getValue();
          const rooms = await this.roomSelect.getRooms();
          const room = rooms.find(r => r.name.toLowerCase() === roomName.toLowerCase());
          
          if (room) {
            try {
              await this.roomDetailsService.addContentItem(room.id, contentItem);
            } catch (error) {
              console.error('Error adding content item to room:', error);
              // Continue with finding submission even if content item update fails
            }
          }
        }

        console.debug('UploadForm: Submitting finding', {
          description: form.description.value.trim(),
          location: this.roomSelect.getValue(),
          hasContentItem: contentItem !== null && contentItem !== undefined,
          contentItem,
          imageCount: this.selectedImages.length
        });

        await this.findingsService.add({
          description: form.description.value.trim(),
          location: this.roomSelect.getValue(),
          content_item: contentItem,
          images: this.selectedImages.length > 0 ? this.selectedImages.map(img => img.file) : [],
          changeoverId: this.changeoverId
        });

        // Reset form
        form.reset();
        this.selectedImages = [];
        this.updateImagePreviews();
        form.classList.remove('was-validated');
        this.container.querySelector('#contentsContainer').innerHTML = '';
        this.contentsSelect = null;
        
        // Refresh findings list
        this.findingsList.refresh();
        
        showErrorAlert('Finding submitted successfully', 'success');
      } catch (error) {
        console.error('Error submitting finding:', error);
        showErrorAlert(error.message || 'Failed to submit finding');
      }
    });
  }

  async analyzeVideo(file) {
    if (this.isAnalyzing) {
      console.debug('UploadForm: Video analysis already in progress');
      return;
    }

    this.isAnalyzing = true;
    this.updateAnalysisStatus('Analyzing video...');

    try {
      console.debug('UploadForm: Starting video analysis');

      // Get rooms from RoomSelect
      const rooms = await this.roomSelect.getRooms();
      
      // Get content items from room details
      const { data: roomDetails } = await supabase
        .from('room_details')
        .select('contents')
        .in('room_id', rooms.map(r => r.id))
        .throwOnError();

      const contentItems = roomDetails
        .flatMap(rd => rd.contents || [])
        .filter(Boolean)
        .map(item => item.name || item);

      console.debug('UploadForm: Got property data', {
        roomCount: rooms?.length,
        itemCount: contentItems?.length
      });

      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('rooms', JSON.stringify(rooms));
      formData.append('contentItems', JSON.stringify(contentItems));

      // Call analysis function
      const response = await supabase.functions.invoke(
        'analyze-video',
        { 
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (response.error) {
        throw new Error(response.error.message || 'Analysis failed');
      }

      const result = response.data;
      if (!result) {
        throw new Error('No analysis results returned');
      }

      console.debug('UploadForm: Video analysis complete', {
        transcript: result.transcript,
        analysis: result.analysis
      });

      await this.handleVideoAnalysis(result);

      this.updateAnalysisStatus('Analysis complete!', 'success');
    } catch (error) {
      console.error('UploadForm: Video analysis error:', error);
      const errorMessage = error.message || 'Analysis failed';
      this.updateAnalysisStatus(errorMessage, 'error');
      showErrorAlert(errorMessage);
      throw error;
    } finally {
      this.isAnalyzing = false;
      // Clear status after delay
      setTimeout(() => this.updateAnalysisStatus(''), 5000);
    }
  }

  async handleVideoAnalysis(result) {
    console.debug('UploadForm: Starting video analysis handling', {
      hasTranscript: !!result.transcript,
      hasAnalysis: !!result.analysis,
      analysisFields: result.analysis ? Object.keys(result.analysis) : []
    });

    const form = this.container.querySelector('#findingForm');
    if (form) {
      if (result.analysis.description) {
        form.description.value = result.analysis.description;
      }
      
      // Store content item for later use
      const pendingContentItem = result.analysis.contentItem;
      
      if (result.analysis.location) {
        console.debug('UploadForm: Setting room with pending content', {
          location: result.analysis.location,
          contentItem: pendingContentItem,
          hasRoomSelect: !!this.roomSelect,
          hasLocationContainer: !!this.container.querySelector('#locationContainer')
        });

        // Add listener before setting room value
        const handleRoomChange = async (e) => {
          const room = e.detail.room;
          console.debug('UploadForm: Room change event received', {
            hasRoom: !!room,
            roomId: room?.id,
            pendingContentItem,
            hasContentsSelect: !!this.contentsSelect
          });

          if (!room) return;

          // Wait for ContentsSelect to be ready
          const maxAttempts = 10;
          const attemptDelay = 200;
          let attempts = 0;

          const trySetContentItem = async () => {
            console.debug('UploadForm: Attempting to set content item', {
              attempt: attempts + 1,
              maxAttempts,
              hasContentsSelect: !!this.contentsSelect,
              isInitialized: this.contentsSelect?.isInitialized,
              contentItem: pendingContentItem
            });

            if (this.contentsSelect?.isInitialized) {
              try {
                await this.contentsSelect.setValue(pendingContentItem);
                console.debug('UploadForm: Content item set successfully');
                return true;
              } catch (error) {
                console.error('Error setting content item:', error);
              }
            }

            attempts++;
            if (attempts < maxAttempts) {
              console.debug('UploadForm: Retrying content item set', {
                nextAttempt: attempts + 1,
                delay: attemptDelay
              });
              await new Promise(resolve => setTimeout(resolve, attemptDelay));
              return trySetContentItem();
            }
            console.warn('UploadForm: Failed to set content item after all attempts');
            return false;
          };

          await trySetContentItem();
        };

        // Add listener with cleanup
        const locationContainer = this.container.querySelector('#locationContainer');
        console.debug('UploadForm: Adding room change listener', {
          hasLocationContainer: !!locationContainer
        });
        locationContainer?.addEventListener('roomchange', handleRoomChange, { once: true });

        // Set room value which will trigger the change
        console.debug('UploadForm: Setting room value', {
          location: result.analysis.location
        });
        this.roomSelect.setValue(result.analysis.location);
      }
    }
  }

  updateAnalysisStatus(message, type = 'info') {
    const statusDiv = this.container.querySelector('#analysisStatus');
    if (statusDiv) {
      if (!message) {
        statusDiv.innerHTML = '';
        return;
      }

      const icon = type === 'error' ? 'AlertCircle' : 
                   type === 'success' ? 'CheckCircle' : 
                   'Loader2';
      
      const color = type === 'error' ? 'text-danger' :
                    type === 'success' ? 'text-success' :
                    'text-primary';

      statusDiv.innerHTML = `
        <div class="d-flex align-items-center gap-2 ${color} small">
          ${IconService.createIcon(icon, { 
            class: type === 'info' ? 'rotate' : '',
            width: '16',
            height: '16'
          })}
          ${message}
        </div>
      `;
    }
  }

  updateImagePreviews() {
    const container = this.container.querySelector('#imagePreviewsContainer');
    container.innerHTML = this.selectedImages.map((img, index) => `
      <div class="col-4 col-md-3">
        <div class="position-relative">
          ${img.isVideo ? `
          <div class="position-relative" style="height: 120px; background: #f8f9fa; display: flex; align-items: center; justify-content: center">
            <i class="fas fa-play fa-2x text-muted"></i>
          </div>
          ` : `
          <img 
            src="${img.previewUrl}" 
            alt="Preview"
            class="img-fluid rounded"
            style="height: 100px; width: 100%; object-fit: cover"
          />
          `}
          <button 
            type="button" 
            class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 remove-image"
            data-index="${index}">
            ${IconService.createIcon('Trash2')}
          </button>
        </div>
      </div>
    `).join('');

    // Attach remove buttons event listeners
    container.querySelectorAll('.remove-image').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        this.selectedImages.splice(index, 1);
        this.updateImagePreviews();
      });
    });
  }
}