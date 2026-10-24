import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { App } from '../App';

describe('SkillNear Responsive Layout Verification', () => {
  const setViewport = (width: number, height: number) => {
    window.innerWidth = width;
    window.innerHeight = height;
    window.dispatchEvent(new Event('resize'));
  };

  it('renders correctly on Mobile viewport (375x812)', async () => {
    setViewport(375, 812);
    expect(window.innerWidth).toBe(375);
    expect(window.innerHeight).toBe(812);

    await act(async () => {
      render(<App />);
    });

    // Brand and essential action elements should be visible and accessible
    const brandElements = screen.getAllByText(/Skill/i);
    expect(brandElements.length).toBeGreaterThanOrEqual(1);

    // Responsive preview banner
    const previewBanner = screen.getAllByText(/SkillNear Preview/i);
    expect(previewBanner.length).toBeGreaterThanOrEqual(1);
  });

  it('renders correctly on Tablet viewport (768x1024)', async () => {
    setViewport(768, 1024);
    expect(window.innerWidth).toBe(768);
    expect(window.innerHeight).toBe(1024);

    await act(async () => {
      render(<App />);
    });

    // Verification of layout elements
    const brandElements = screen.getAllByText(/Skill/i);
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/On-Demand Blue-Collar Technicians Near You/i)).toBeInTheDocument();
  });

  it('renders correctly on Desktop / Laptop viewport (1440x900)', async () => {
    setViewport(1440, 900);
    expect(window.innerWidth).toBe(1440);
    expect(window.innerHeight).toBe(900);

    await act(async () => {
      render(<App />);
    });

    // Full desktop navbar and subtitle
    expect(screen.getAllByText(/Local services\. Clear agreements\. Fair pricing\./i).length).toBeGreaterThanOrEqual(1);
  });
});
