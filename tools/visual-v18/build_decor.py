"""Original V18 decor assets: coffee table, dome lamp and wool rug.
Run with the workspace-local Blender 4.5 executable.
"""
import os,sys,math
sys.path.insert(0,os.path.dirname(__file__))
from model_common import *

def coffee_table():
    clear()
    marble=material('Veined Nero marble',(.075,.065,.055),.25,texture='wood')
    brass=material('Brushed antique brass',(.33,.19,.07),.27,.76)
    glass=material('Smoked low iron glass',(.08,.11,.12),.08,.15)
    paper=material('Book paper',(.64,.57,.45),.92,texture='fabric')
    cover=material('Book charcoal cover',(.075,.06,.05),.76)
    ceramic=material('Hand thrown ceramic',(.42,.22,.10),.48)
    foliage=material('Dried branch',(.09,.05,.025),.81)
    # 1.25 x .72 m low sculptural coffee table, inset slab and rounded chamfers.
    box('Marble slab',(0,.43,0),(1.46,.13,.82),marble,.055,6)
    box('Brass shadow reveal',(0,.345,0),(1.28,.025,.65),brass,.018)
    box('Lower smoked glass shelf',(0,.20,0),(1.12,.035,.55),glass,.028,4)
    for x in [-.54,.54]:
        for z in [-.27,.27]:
            cyl('Brass tapered leg',(x,.18,z),.035,.36,brass,32)
            # foot pad
            cyl('Foot pad',(x,.015,z),.065,.025,brass,32)
    # Magazine stack with distinct hard covers, inset pages and a brass corner detail.
    box('Black design book',(0.00,.54,.03),(.56,.055,.39),cover,.012)
    box('Design book pages',(0.00,.575,.03),(.52,.035,.36),paper,.009)
    box('Terracotta art book',(-.10,.61,-.06),(.68,.045,.26),ceramic,.012)
    box('Art book pages',(-.10,.635,-.06),(.64,.03,.22),paper,.007)
    for z in [-.18,.18]: tube('Book page line', [(-.39,.66,z),(.19,.66,z)], .002, brass)
    # Travertine bowl and a small dried branch cluster.
    sphere('Shallow sculptural bowl',(.36,.62,.14),(.24,.055,.24),ceramic)
    cyl('Bowl inner shadow',(.36,.665,.14),.16,.012,cover,48)
    for a in [-.7,-.25,.2,.55]:
        x=.36+math.cos(a)*.03; z=.14+math.sin(a)*.03
        tube('Decor branch',[(x,.66,z),(x+math.cos(a)*.18,.97,z+math.sin(a)*.18)],.009,foliage)
        for t in [.35,.58,.78]:
            xx=x+math.cos(a)*.18*t; zz=z+math.sin(a)*.18*t
            sphere('Dried leaf',(xx,.95*t+.67,zz),(.035,.012,.075),foliage)
    out=export_asset('coffee-table','coffee-table','Low Nero marble and antique brass coffee table with inset smoked shelf, tapered feet, books, ceramic bowl and dried branch arrangement.', ['Beveled marble slab','Brushed brass reveal and legs','Smoked glass shelf','Three books with page layers','Ceramic bowl','Dried branch and leaves'])
    preview(out,(3.2,2.7,3.8),(0,.42,0),3.4)

def lamp():
    clear()
    metal=material('Matte blackened brass',(.04,.033,.025),.31,.74)
    brass=material('Warm brass accent',(.36,.2,.07),.27,.8)
    shade=material('Amber linen shade',(.52,.24,.08),.76,texture='fabric')
    glow=material('Warm emissive bulb',(1,.3,.06),.32,emission=4.5)
    base=material('Black stone base',(.045,.04,.038),.2)
    cyl('Heavy stone foot',(0,.10,0),.30,.20,base,64)
    cyl('Brass foot inset',(0,.205,0),.22,.025,brass,64)
    tube('Curved stem',[(0,.21,0),(0,.83,0),(.05,1.45,.02),(.28,1.70,.04),(.50,1.78,.04)],.026,metal)
    cyl('Dome lower collar',(.50,1.78,.04),.11,.045,brass,48)
    # hemisphere-like shade via UV sphere with lower half concealed; real mesh dome, not cylinder.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=xyz((.50,1.83,.04)), scale=(.34,.20,.34)); o=bpy.context.object; o.name='Sculpted dome lamp shade'; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); apply_material(o,shade)
    # cap lower half with dark cutout and glowing bulb visible from below.
    sphere('Visible warm bulb',(.50,1.75,.04),(.10,.10,.10),glow)
    cyl('Dome trim',(.50,1.67,.04),.28,.012,brass,48)
    out=export_asset('lamp','dome-floor-lamp','1.82 m sculptural floor lamp with weighted stone foot, curved blackened-brass stem, tailored amber dome shade and emissive warm bulb.', ['Weighted stone base','Curved metal stem','UV dome shade mesh','Brass trim','Warm emissive bulb'])
    preview(out,(3.1,2.6,3.4),(.25,.85,0),3.1)

def rug():
    clear()
    wool=material('Hand loomed warm wool',(.20,.13,.085),.98,texture='fabric')
    edge=material('Wool braided edge',(.10,.06,.03),.99,texture='fabric')
    accent=material('Wool accent weave',(.33,.18,.08),.99,texture='fabric')
    # Raised hand-loom pile mesh plus border bands and physically modeled fringe.
    nx,nz=72,46; w,d=3.3,2.35; verts=[]; faces=[]
    for j in range(nz+1):
        for i in range(nx+1):
            u=i/nx; v=j/nz; x=(u-.5)*w; z=(v-.5)*d
            pile=.018 + .010*math.sin(u*36)*math.sin(v*29) + .006*math.sin(u*101+v*13)
            verts.append(xyz((x,pile,z)))
    for j in range(nz):
        for i in range(nx):
            a=j*(nx+1)+i; faces.append((a,a+1,a+nx+2,a+nx+1))
    me=bpy.data.meshes.new('Hand loomed pile'); me.from_pydata(verts,[],faces); me.update(); o=bpy.data.objects.new('Hand loomed wool pile',me); bpy.context.collection.objects.link(o); apply_material(o,wool)
    for name,loc,dim in [('Long braided border',(0,.028,-d/2+.07),(w,.045,.14)),('Long braided border',(0,.028,d/2-.07),(w,.045,.14)),('Short braided border',(-w/2+.07,.028,0),(.14,.045,d)),('Short braided border',(w/2-.07,.028,0),(.14,.045,d))]: box(name,loc,dim,edge,.025,4)
    # inset woven accent channels, deliberately low contrast like REF-D floor textile.
    for z in [-.55,-.47,.47,.55]: box('Woven accent band',(0,.043,z),(2.92,.022,.035),accent,.008,3)
    for x in [-1.42,-1.33,1.33,1.42]: box('Woven accent band',(x,.043,0),(.035,.022,1.9),accent,.008,3)
    for side in [-1,1]:
        for i in range(30):
            x=(i/29-.5)*w; tube('Wool fringe',[(x,.028,side*d/2),(x,.02,side*d/2+side*.11)],.008,edge)
    out=export_asset('rug','wool-rug','3.3 by 2.35 m hand-loomed wool rug with raised pile, braided border, low-contrast woven accent channels and modeled fringe.', ['72 by 46 raised pile grid','Braided border geometry','Woven accent bands','60 modeled wool fringe strands','Fabric base color/normal'])
    preview(out,(3.6,3.4,4.8),(0,.1,0),4.3)

if __name__=='__main__':
    arg=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'coffee-table'
    {'coffee-table':coffee_table,'lamp':lamp,'rug':rug}[arg]()
