import { getAirbnbListingUrl } from './utils/calendarUtils.js';
import { AirbnbService } from './services/AirbnbService.js';

// Test URL transformation
const calendarUrl = 'https://www.airbnb.com/calendar/ical/738341757810804630.ics?s=909fa3b308c3817d076b24f5f2e1a38d&locale=en-GB';
const listingUrl = getAirbnbListingUrl(calendarUrl);
console.log('Calendar URL:', calendarUrl);
console.log('Listing URL:', listingUrl);

// Test API fetch
const airbnbService = new AirbnbService();
airbnbService.getListingDetails(calendarUrl)
  .then(details => {
    console.log('Listing Details:', details);
  })
  .catch(error => {
    console.error('Error:', error);
  });