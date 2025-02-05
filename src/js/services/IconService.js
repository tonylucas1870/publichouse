export class IconService {
  static initialize() {
    // Font Awesome is loaded via CSS, no initialization needed
  }

  static createIcon(name, options = {}) {
    const iconMap = {
      // Navigation and actions
      ArrowLeft: 'fa-arrow-left',
     Calendar: 'fa-calendar-alt',
      Camera: 'fa-camera',
     CreditCard: 'fa-credit-card',
      Check: 'fa-check',
      Clock: 'fa-clock',
      Edit: 'fa-pen',
      Filter: 'fa-filter',
      Home: 'fa-home',
      ChevronUp: 'fa-chevron-up',
      ChevronDown: 'fa-chevron-down',
      Lock: 'fa-lock',
      Mail: 'fa-envelope',
      MapPin: 'fa-map-marker-alt',
      Plus: 'fa-plus',
      Save: 'fa-save',
      Share2: 'fa-share-alt',
      Trash2: 'fa-trash-alt',
      Type: 'fa-font',
      Upload: 'fa-upload',
      Zap: 'fa-bolt',
      Search: 'fa-search',
      ChevronUp: 'fa-chevron-up',
      ChevronDown: 'fa-chevron-down',
     Sync: 'fa-sync',
     ListChecks: 'fa-tasks',
      Grid: 'fa-th',
      List: 'fa-list',

      // Property and room management
      Building: 'fa-building',
      DoorClosed: 'fa-door-closed',
      Key: 'fa-key',
      Settings: 'fa-cog',
      Users: 'fa-users',

      // Status icons
      CheckCircle: 'fa-check-circle',
      XCircle: 'fa-times-circle',

      // Utilities and features
      BedDouble: 'fa-bed',
      Lightbulb: 'fa-lightbulb',
      PaintBucket: 'fa-paint-roller',
      Ruler: 'fa-ruler',
      Sofa: 'fa-couch',
      MessageSquare: 'fa-comment'
    };

    const iconClass = iconMap[name] || 'fa-question';
    const size = options.width ? `fa-${Math.ceil(options.width / 16)}x` : '';
    const classes = options.class ? ` ${options.class}` : '';

    return `<i class="fas ${iconClass} ${size}${classes}"></i>`;
  }

  static getStatusIcon(status, size = 16) {
    const iconMap = {
      pending: 'fa-clock',
      fixed: 'fa-check-circle',
      wont_fix: 'fa-times-circle'
    };

    const iconClass = iconMap[status] || 'fa-clock';
    return `<i class="fas ${iconClass} fa-${size}x"></i>`;
  }
}