export const metadata = {
  title: "Size Guide | After Hours Agenda",
  description: "Find your perfect fit with our size guide.",
};

export default function SizeGuidePage() {
  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display font-bold text-chapter text-center mb-4">SIZE GUIDE</h1>
        <p className="text-center text-muted mb-12 max-w-md mx-auto">Most of our pieces run true to size. For an oversized fit, size up one.</p>

        <div className="space-y-8">
          <div>
            <h2 className="font-display font-bold text-lg mb-4">Unisex T-Shirts</h2>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-left">
                    <th className="py-3 pr-4">Size</th>
                    <th className="py-3 pr-4">Chest (in)</th>
                    <th className="py-3 pr-4">Length (in)</th>
                  </tr>
                </thead>
                <tbody className="text-cream/80">
                  <tr className="border-b border-border/50"><td className="py-2.5 pr-4">S</td><td className="py-2.5 pr-4">34-36</td><td className="py-2.5">27</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2.5 pr-4">M</td><td className="py-2.5 pr-4">38-40</td><td className="py-2.5">28</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2.5 pr-4">L</td><td className="py-2.5 pr-4">42-44</td><td className="py-2.5">29</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2.5 pr-4">XL</td><td className="py-2.5 pr-4">46-48</td><td className="py-2.5">30</td></tr>
                  <tr><td className="py-2.5 pr-4">2XL</td><td className="py-2.5 pr-4">50-52</td><td className="py-2.5">31</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg mb-4">Sweatshirts & Hoodies</h2>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-left">
                    <th className="py-3 pr-4">Size</th>
                    <th className="py-3 pr-4">Chest (in)</th>
                    <th className="py-3 pr-4">Length (in)</th>
                  </tr>
                </thead>
                <tbody className="text-cream/80">
                  <tr className="border-b border-border/50"><td className="py-2.5 pr-4">S</td><td className="py-2.5 pr-4">36-38</td><td className="py-2.5">26</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2.5 pr-4">M</td><td className="py-2.5 pr-4">40-42</td><td className="py-2.5">27</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2.5 pr-4">L</td><td className="py-2.5 pr-4">44-46</td><td className="py-2.5">28</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2.5 pr-4">XL</td><td className="py-2.5 pr-4">48-50</td><td className="py-2.5">29</td></tr>
                  <tr><td className="py-2.5 pr-4">2XL</td><td className="py-2.5 pr-4">52-54</td><td className="py-2.5">30</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
