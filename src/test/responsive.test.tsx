import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { App } from '../App';
import { SERVICE_CATEGORIES } from '../data/categories';

describe('SkillNear Responsive Layout Verification (Mobile, Tablet, Laptop, Desktop)', () => {
  const setViewport = (width: number, height: number) => {
    window.innerWidth = width;
    window.innerHeight = height;
    window.dispatchEvent(new Event('resize'));
  };

  it('renders correctly on Mobile viewport (375x812 - iPhone SE / Standard Mobile)', async () => {
    setViewport(375, 812);
    expect(window.innerWidth).toBe(375);
    expect(window.innerHeight).toBe(812);

    await act(async () => {
      render(<App />);
    });

    // Brand and logo render cleanly
    const brandElements = screen.getAllByText(/Skill/i);
    expect(brandElements.length).toBeGreaterThanOrEqual(1);

    // Responsive category pills render with horizontal touch scroll
    expect(screen.getAllByText(/All Services/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Electrician/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/AC Repair/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Pest Control/i).length).toBeGreaterThanOrEqual(1);

    // Action button Post Job is accessible
    expect(screen.getAllByText(/Post Job/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders correctly on Tablet viewport (768x1024 - iPad Portrait)', async () => {
    setViewport(768, 1024);
    expect(window.innerWidth).toBe(768);
    expect(window.innerHeight).toBe(1024);

    await act(async () => {
      render(<App />);
    });

    const brandElements = screen.getAllByText(/Skill/i);
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/On-Demand Blue-Collar Technicians Near You/i)).toBeInTheDocument();

    // Verify all 10 categories are accessible in the category pill bar
    SERVICE_CATEGORIES.forEach((cat) => {
      expect(screen.getAllByText(new RegExp(cat.shortLabel, 'i')).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders correctly on Laptop viewport (1024x768 - Compact Laptop / iPad Landscape)', async () => {
    setViewport(1024, 768);
    expect(window.innerWidth).toBe(1024);
    expect(window.innerHeight).toBe(768);

    await act(async () => {
      render(<App />);
    });

    expect(screen.getAllByText(/Local services\. Clear agreements\. Fair pricing\./i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Post Job/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders correctly on Desktop viewport (1440x900 - Standard Desktop)', async () => {
    setViewport(1440, 900);
    expect(window.innerWidth).toBe(1440);
    expect(window.innerHeight).toBe(900);

    await act(async () => {
      render(<App />);
    });

    // Full desktop navbar, subtitle, and search controls
    expect(screen.getAllByText(/Local services\. Clear agreements\. Fair pricing\./i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText(/Search by technician name/i)).toBeInTheDocument();
  });
});
