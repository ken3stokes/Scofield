# SCOFIELD - Goal Execution System

A powerful SMART Goals tracking system designed to help you achieve your objectives effectively.

## Project Structure

The project is organized as follows:

- `/` (root): Contains the current production version that is live
  - `index.html`: Landing page with project overview
  - `goals.html`: SMART Goals tracking interface
- `/dev`: Development workspace for new features and fixes
- `/releases`: Archive of previous versions
  - `/releases/v1.2`: Version 1.2 release
  - `/releases/v1.3`: Version 1.3 release (in development)

## Development Workflow

1. All new development work should be done in the `/dev` directory
2. Once features are tested and ready:
   - Copy the changes to the root directory for production
   - Archive the complete version in `/releases/vX.X`
3. The root directory always reflects what's live on the website

## Features

- Create and manage SMART goals
- Private data storage using IndexedDB (all data stays on your device)
- Export/Import functionality for data backup
- Mobile-responsive design
- Goal progress tracking
- Task management for each goal
- Visual analytics and reports
- PDF report generation

## Recent Updates (v1.2.1)

- Improved navigation with direct access to SMART goals tool
- Enhanced landing page with clearer call-to-action
- Previous v1.2.0 updates:
  - Simplified PDF report generation for better reliability
  - Enhanced report visualization with clear charts
  - Improved overall system stability
- Previous v1.1.0 updates:
  - Added Export/Import functionality for data backup
  - Improved mobile responsiveness
  - Enhanced UI spacing and readability
  - Added privacy-focused local storage

## Privacy Features

- All data is stored locally in your browser
- No server-side storage or transmission
- Backup system for data preservation
- No external dependencies for data storage

## Getting Started

1. Visit the landing page at `index.html`
2. Click any of the action buttons to access the SMART goals tool
3. Start creating and tracking your goals
4. Use the export feature regularly to backup your data

## Reports and Analytics

- Generate PDF reports of your goals and progress
- View goal distribution by status and type
- Track completion rates and progress

## Backup & Restore

- Click "Export" to save your goals as a JSON file
- Click "Import" to restore from a backup file
- Backups are dated for easy management

## Browser Support

- Chrome (Recommended)
- Firefox
- Edge
- Safari

## License

MIT License - Feel free to modify for personal use
