export type PastTrip = {
  id: string;
  name: string;
  date: string;
  location: string;
  image: string;
  travelers: number;
  size?: "sm" | "md" | "lg" | "xl";
};

export const pastTrips: PastTrip[] = [
  {
    id: "p1",
    name: "Spiti Valley Saga",
    date: "Sep 2025",
    location: "Himachal Pradesh",
    image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200&q=80",
    travelers: 16,
    size: "xl",
  },
  {
    id: "p2",
    name: "Wayanad Monsoon",
    date: "Aug 2025",
    location: "Kerala",
    image: "https://images.unsplash.com/photo-1597211833712-5e41faa202ea?w=900&q=80",
    travelers: 22,
    size: "md",
  },
  {
    id: "p3",
    name: "Gokarna Beach Days",
    date: "Jul 2025",
    location: "Karnataka",
    image: "https://images.unsplash.com/photo-1471922694854-ff1b63b20054?w=900&q=80",
    travelers: 14,
    size: "md",
  },
  {
    id: "p4",
    name: "Coorg Coffee Trails",
    date: "Jun 2025",
    location: "Karnataka",
    image: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=900&q=80",
    travelers: 18,
    size: "lg",
  },
  {
    id: "p5",
    name: "Pondicherry Pastels",
    date: "Mar 2025",
    location: "Tamil Nadu",
    image: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=900&q=80",
    travelers: 20,
    size: "sm",
  },
  {
    id: "p6",
    name: "Andaman Island Hop",
    date: "Feb 2025",
    location: "Andaman & Nicobar",
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200&q=80",
    travelers: 12,
    size: "lg",
  },
  {
    id: "p7",
    name: "Hampi Heritage",
    date: "Dec 2024",
    location: "Karnataka",
    image: "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=900&q=80",
    travelers: 15,
    size: "md",
  },
  {
    id: "p8",
    name: "Meghalaya Living Roots",
    date: "Nov 2024",
    location: "Meghalaya",
    image: "https://images.unsplash.com/photo-1572902403139-12231a14721f?w=900&q=80",
    travelers: 11,
    size: "md",
  },
  {
    id: "p9",
    name: "Rann of Kutch Festival",
    date: "Jan 2025",
    location: "Gujarat",
    image: "https://images.unsplash.com/photo-1605640840605-14ac1855827b?w=1200&q=80",
    travelers: 24,
    size: "xl",
  },
];

export const testimonials = [
  {
    name: "Anitha R.",
    trip: "Spiti Valley Saga · 2025",
    quote:
      "I went solo and came back with a WhatsApp group I still talk to every day. DOT genuinely felt like home on wheels.",
    avatar: "https://i.pravatar.cc/200?img=49",
  },
  {
    name: "Karthik S.",
    trip: "Coorg Coffee Trails · 2025",
    quote:
      "Every detail was thought through — from the songs on the bus to where we stopped for tea. You can tell they've been there themselves.",
    avatar: "https://i.pravatar.cc/200?img=33",
  },
  {
    name: "Divya & Suresh",
    trip: "Mom & Kutties · 2025",
    quote:
      "Going on a trip with a 5-year-old usually means I plan everything. This time I actually got to relax. The kids made best friends.",
    avatar: "https://i.pravatar.cc/200?img=45",
  },
];

export const stats = [
  { value: "30+", label: "Trips Run" },
  { value: "200+", label: "Travelers Hosted" },
  { value: "12", label: "Destinations" },
  { value: "2023", label: "Founded" },
];
